// tslint:disable: completed-docs
import { AsyncAllIterable, Context, File, FilterFunction } from "@code-engine/types";
import { createFile, iterate } from "@code-engine/utils";
import { createFilter } from "file-path-filter";
import { ono } from "ono";
import { NormalizedPlugin } from "./types";

/**
 * The names of plugin methods
 */
enum PluginMethod {
  ProcessFile = "processFile",
  ProcessFiles = "processFiles",
  Read = "read",
  Watch = "watch",
  Clean = "clean",
  Dispose = "dispose",
}

/**
 * An object containing plugin methods
 */
type PluginMethods = { [m in PluginMethod]?: NormalizedPlugin[m] };


/**
 * The internal CodeEngine implementation of the `Plugin` interface.
 * @internal
 */
export class CodeEnginePlugin {
  public readonly name: string;
  public readonly filter?: FilterFunction;
  private readonly _methods: PluginMethods = {};

  public constructor(plugin: NormalizedPlugin) {
    this.name = plugin.name;

    if (plugin.filter !== undefined) {
      this.filter = createFilter({ map }, plugin.filter);
    }

    for (let method of Object.values(PluginMethod)) {
      if (plugin[method]) {
        // @ts-ignore  Store a reference to this plugin's method
        this._methods[method] = plugin[method];
      }
      else {
        // This plugin doesn't implement this method,
        // so remove the corresponding method from this class
        this[method] = undefined;
      }
    }
  }

  // tslint:disable-next-line: no-async-without-await
  public async* processFile?(file: File, context: Context): AsyncGenerator<File> {
    try {
      let fileInfos;

      if (this.filter && !this.filter(file, context)) {
        fileInfos = file;
      }
      else {
        fileInfos = this._methods.processFile!(file, context);
      }

      for await (let fileInfo of iterate(fileInfos)) {
        yield createFile(fileInfo);
      }
    }
    catch (error) {
      throw ono(error, { path: file.path }, `An error occurred in ${this} while processing ${file}.`);
    }
  }

  public async* processFiles?(files: AsyncAllIterable<File>, context: Context): AsyncGenerator<File> {
    try {
      let fileInfos;

      if (this.filter) {
        let filteredFiles = [];

        // Determine which files match the filter
        for await (let file of files) {
          if (this.filter(file, context)) {
            // This file matches the filter, so add it to the list to be passed to the plugin
            filteredFiles.push(file);
          }
          else {
            // This file does NOT match the filter, so immediately pass it along
            yield file;
          }
        }

        // Allow the plugin to process the files that matched the filter
        fileInfos = await this._methods.processFiles!(iterate(filteredFiles), context);
      }
      else {
        // There is no filter, so process the full list of files
        fileInfos = this._methods.processFiles!(files, context);
      }

      for await (let fileInfo of iterate(fileInfos)) {
        yield createFile(fileInfo);
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing files.`);
    }
  }

  // tslint:disable-next-line: no-async-without-await
  public async* read?(context: Context): AsyncGenerator<File> {
    try {
      let fileInfos = this._methods.read!(context);

      for await (let fileInfo of iterate(fileInfos)) {
        yield createFile(fileInfo);
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while watching source files for changes.`);
    }
  }

  // tslint:disable-next-line: no-async-without-await
  public async* watch?(context: Context): AsyncGenerator<File> {
    try {
      let changedFileInfos = this._methods.watch!(context);

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
      await this._methods.clean!(context);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while cleaning the destination.`);
    }
  }

  public async dispose?(context: Context): Promise<void> {
    try {
      await this._methods.dispose!(context);
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
