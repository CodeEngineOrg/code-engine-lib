// tslint:disable: completed-docs
import { ChangedFileInfo, File, FileInfo, FilterFunction, MountedPlugin, Run } from "@code-engine/types";
import { createChangedFile, createFile, drainIterable, IterableWriter, iterate } from "@code-engine/utils";
import { createFilter } from "file-path-filter";
import { ono } from "ono";
import { Change } from "../run/watch";
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

    plugin.initialize || (this.initialize = undefined);
    plugin.processFile || (this.processFile = undefined);
    plugin.processFiles || (this.processFiles = undefined);
    plugin.read || (this.read = undefined);
    plugin.watch || (this.watch = undefined);
    plugin.clean || (this.clean = undefined);
    plugin.dispose || (this.dispose = undefined);
  }

  public async initialize?(): Promise<void> {
    try {
      await this._plugin.initialize!();
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while it was initializing.`);
    }
  }

  // tslint:disable-next-line: no-async-without-await
  public async* processFiles?(files: AsyncIterable<File>, run: Run): AsyncGenerator<File> {
    try {
      let fileInfos = this._plugin.processFiles!(files, run);

      for await (let fileInfo of iterate(fileInfos)) {
        yield createFile(fileInfo, this.name);
      }

      // Ensure that all input files are read, even if the plugin doesn't actually read them.
      // Otherwise the run will never complete.
      await drainIterable(files);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing files.`);
    }
  }

  public async processFile?(file: File, run: Run, output: IterableWriter<File>): Promise<void> {
    try {
      let fileInfos = this._plugin.processFile!(file, run);

      for await (let fileInfo of iterate(fileInfos)) {
        await output.write(createFile(fileInfo, this.name));
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing ${file}.`);
    }
  }

  public read?(run: Run): AsyncIterable<File> {
    let iterator: AsyncIterator<FileInfo>;

    try {
      // NOTE: The reason we don't just use a `for await...of` loop here is that we want to be able to
      // ead multiple files simultaneously if the `processFile()` plugins are faster than the IO source.
      let fileInfos = this._plugin.read!(run);
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
  public async* watch?(): AsyncGenerator<Change> {
    try {
      // Create a callback function that yields a changed file
      let writer = new IterableWriter<ChangedFileInfo>();
      let callback = (file: ChangedFileInfo) => writer.write(file);

      let changedFileInfos = this._plugin.watch!(callback);

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

  public async clean?(): Promise<void> {
    try {
      await this._plugin.clean!();
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while cleaning the destination.`);
    }
  }

  public async dispose?(): Promise<void> {
    try {
      await this._plugin.dispose!();
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while cleaning-up.`);
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
