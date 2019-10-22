// tslint:disable: completed-docs
import { AsyncAllIterable, Context, File, FilterFunction } from "@code-engine/types";
import { createFile, IterableWriter, iterate } from "@code-engine/utils";
import { createFilter } from "file-path-filter";
import { ono } from "ono";
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
  }

  // tslint:disable-next-line: no-async-without-await
  public async* processFiles?(files: AsyncAllIterable<File>, context: Context): AsyncGenerator<File> {
    try {
      let fileInfos = this._plugin.processFiles!(files, context);

      for await (let fileInfo of iterate(fileInfos)) {
        yield createFile(fileInfo);
      }

      // Ensure that all input files are read, even if the plugin doesn't actually read them.
      // Otherwise the build will never complete.
      await files.all();
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing files.`);
    }
  }

  // tslint:disable-next-line: no-async-without-await
  public async processFile?(file: File, context: Context, output: IterableWriter<File>): Promise<void> {
    try {
      let fileInfos = this._plugin.processFile!(file, context);

      for await (let fileInfo of iterate(fileInfos)) {
        await output.write(createFile(fileInfo));
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing ${file}.`);
    }
  }

  // tslint:disable-next-line: no-async-without-await
  public async* read?(context: Context): AsyncGenerator<File> {
    try {
      let fileInfos = this._plugin.read!(context);

      for await (let fileInfo of iterate(fileInfos)) {
        yield createFile(fileInfo);
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while reading source files.`);
    }
  }

  // tslint:disable-next-line: no-async-without-await
  public async* watch?(context: Context): AsyncGenerator<File> {
    try {
      let changedFileInfos = this._plugin.watch!(context);

      for await (let fileInfo of iterate(changedFileInfos)) {
        yield createFile(fileInfo);
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
      throw ono(error, `An error occurred in ${this} while watching source files for changes.`);
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
