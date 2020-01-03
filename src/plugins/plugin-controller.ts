// tslint:disable: completed-docs
import { BuildContext, BuildSummary, ChangedFile, ChangedFileInfo, Context, EventName, File, FileInfo, FilterFunction, LogEventData } from "@code-engine/types";
import { createChangedFile, createFile, drainIterable, IterableWriter, iterate } from "@code-engine/utils";
import { createFilter } from "file-path-filter";
import { ono } from "ono";
import { Change } from "../build/watch";
import { NormalizedPlugin } from "./normalize-plugin";

/**
 * Wraps a plugin's functionality in a consistent interface.
 * @internal
 */
export class PluginController {
  public readonly name: string;
  public readonly filter: FilterFunction;
  private readonly _plugin: NormalizedPlugin;

  public constructor(plugin: NormalizedPlugin) {
    this.name = plugin.name;
    this.filter = createFilter({ map }, plugin.filter === undefined ? true : plugin.filter);
    this._plugin = plugin;

    plugin.processFile || (this.processFile = undefined);
    plugin.processFiles || (this.processFiles = undefined);
    plugin.read || (this.read = undefined);
    plugin.watch || (this.watch = undefined);
    plugin.clean || (this.clean = undefined);
    plugin.dispose || (this.dispose = undefined);
    plugin.onBuildStarting || (this.onBuildStarting = undefined);
    plugin.onBuildFinished || (this.onBuildFinished = undefined);
    plugin.onFileChanged || (this.onFileChanged = undefined);
    plugin.onError || (this.onError = undefined);
    plugin.onLog || (this.onLog = undefined);
  }

  // tslint:disable-next-line: no-async-without-await
  public async* processFiles?(files: AsyncIterable<File>, context: BuildContext): AsyncGenerator<File> {
    try {
      let fileInfos = this._plugin.processFiles!(files, context);

      for await (let fileInfo of iterate(fileInfos)) {
        yield createFile(fileInfo, this.name);
      }

      // Ensure that all input files are read, even if the plugin doesn't actually read them.
      // Otherwise the build will never complete.
      await drainIterable(files);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing files.`);
    }
  }

  public async processFile?(file: File, context: BuildContext, output: IterableWriter<File>): Promise<void> {
    try {
      let fileInfos = this._plugin.processFile!(file, context);

      for await (let fileInfo of iterate(fileInfos)) {
        await output.write(createFile(fileInfo, this.name));
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing ${file}.`);
    }
  }

  public read?(context: BuildContext): AsyncIterable<File> {
    let iterator: AsyncIterator<FileInfo>;

    try {
      // NOTE: The reason we don't just use a `for await...of` loop here is that we want to be able to
      // ead multiple files simultaneously if the `processFile()` plugins are faster than the IO source.
      let fileInfos = this._plugin.read!(context);
      iterator = iterate(fileInfos)[Symbol.asyncIterator]();
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while reading source files.`);
    }

    let next = async () => {
      try {
        let result = await iterator.next();

        if (result.done) {
          return result;
        }

        let file = createFile(result.value, this.name);
        return { value: file };
      }
      catch (error) {
        throw ono(error, `An error occurred in ${this} while reading source files.`);
      }
    };

    return { [Symbol.asyncIterator]: () => ({ next }) };
  }

  // tslint:disable-next-line: no-async-without-await
  public async* watch?(context: Context): AsyncGenerator<Change> {
    try {
      // Create a callback function that yields a changed file
      let writer = new IterableWriter<ChangedFileInfo>();
      let callback = (file: ChangedFileInfo) => writer.write(file);

      let changedFileInfos = this._plugin.watch!(context, callback);

      if (changedFileInfos) {
        // The plugin returned an async iterable, so read from it
        // in addition to any values that are written via the callback function.
        let iterator = iterate(changedFileInfos)[Symbol.asyncIterator]();

        writer.onRead = async () => {
          try {
            let result = await iterator.next();

            if (result.done) {
              await writer.end();
            }
            else {
              await writer.write(result.value);
            }
          }
          catch (error) {
            await writer.throw(error as Error);
          }
        };
      }

      for await (let changedFileInfo of writer.iterable) {
        let file = createChangedFile(changedFileInfo, this.name);

        // Return an additional flag that indicates whether any contents were actually specified.
        // This is necessary because the ChangedFile object has defaults applied.
        let hasContents = Boolean(changedFileInfo.contents || changedFileInfo.text);

        yield { file, hasContents };
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while watching source files for changes.`);
    }
  }

  public async clean?(context: Context): Promise<void> {
    try {
      await this._plugin.clean!(context);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while cleaning the destination.`);
    }
  }

  public async dispose?(context: Context): Promise<void> {
    try {
      await this._plugin.dispose!(context);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while cleaning-up.`);
    }
  }

  public onBuildStarting?(context: BuildContext): void {
    this._callEventListener(EventName.BuildStarting, this._plugin.onBuildStarting!, context);
  }

  public onBuildFinished?(summary: BuildSummary): void {
    this._callEventListener(EventName.BuildFinished, this._plugin.onBuildFinished!, summary);
  }

  public onFileChanged?(file: ChangedFile, context: Context): void {
    this._callEventListener(EventName.FileChanged, this._plugin.onFileChanged!, file, context);
  }

  public onError?(error: Error, context: Context): void {
    this._callEventListener(EventName.Error, this._plugin.onError!, error, context);
  }

  public onLog?(data: LogEventData, context: Context): void {
    this._callEventListener(EventName.Log, this._plugin.onLog!, data, context);
  }

  // tslint:disable-next-line: ban-types
  private _callEventListener(eventName: EventName, listener: Function, ...args: unknown[]): void {
    try {
      let promise = listener.apply(this._plugin, args);

      if (promise) {
        // Wrap and re-throw async errors, just like synchronous errors
        Promise.resolve(promise)
          .catch((error: Error) => {
            throw ono(error, `An error occurred in ${this} while handling a "${eventName}" event.`);
          });
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while handling a "${eventName}" event.`);
    }
  }

  /**
   * Returns a string representation of the plugin.
   */
  public toString(): string {
    return this.name;
  }
}


/**
 * Maps `File` objects to paths for filtering
 */
function map(file: File): string {
  return file.path;
}
