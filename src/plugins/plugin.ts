// tslint:disable: completed-docs
import { AsyncAllIterable, Context, File, FileInfo, FilterFunction, ZeroOrMore } from "@code-engine/types";
import { createFile, createWritableIterator, iterate, WritableIterator } from "@code-engine/utils";
import { createFilter } from "file-path-filter";
import { ono } from "ono";
import { NormalizedPlugin } from "../plugins/types";


/**
 * Exposes a Plugin's functionality to CodeEngine.
 * @internal
 */
export class CodeEnginePlugin {
  public readonly name: string;
  public readonly filter: FilterFunction;
  private readonly _methods: {
    processFile?: NormalizedPlugin["processFile"];
    processFiles?: NormalizedPlugin["processFiles"];
    read?: NormalizedPlugin["read"];
    watch?: NormalizedPlugin["watch"];
    clean?: NormalizedPlugin["clean"];
    dispose?: NormalizedPlugin["dispose"];
  };

  public constructor(plugin: NormalizedPlugin) {
    this.name = plugin.name;
    this.filter = createFilter({ map }, plugin.filter === undefined ? true : plugin.filter);

    if (!plugin.processFile && !plugin.processFiles) {
      this.processFiles = undefined;
    }

    this._methods = {
      processFile: plugin.processFile,
      processFiles: plugin.processFiles,
      read: plugin.read || (this.read = undefined),
      watch: plugin.watch || (this.watch = undefined),
      clean: plugin.clean || (this.clean = undefined),
      dispose: plugin.dispose || (this.dispose = undefined),
    };
  }

  // tslint:disable-next-line: no-async-without-await
  public async* processFiles?(files: AsyncAllIterable<File>, context: Context): AsyncGenerator<File> {
    try {
      // Used to push files into the plugin's processFiles() method
      let processFilesIterator: undefined | WritableIterator<File>;
      let processFilesOutput: ZeroOrMore<FileInfo> | Promise<ZeroOrMore<FileInfo>>;

      if (this._methods.processFiles) {
        // Call the plugin's processFiles() method with an initially-empty iterator.
        // Files will be pushed into the stream as they arrive.
        processFilesIterator = createWritableIterator();
        processFilesOutput = this._methods.processFiles(processFilesIterator, context);
      }

      for await (let file of files) {
        if (!this.filter(file, context)) {
          // This file doesn't match the plugin's filter criteria, so just forward it on
          yield file;
        }
        else {
          if (this._methods.processFile) {
            let fileInfos = this._methods.processFile(file, context);

            for await (let fileInfo of iterate(fileInfos)) {
              yield createFile(fileInfo);
            }
          }

          if (processFilesIterator) {
            await processFilesIterator.next(file);
          }
        }
      }

      if (processFilesIterator) {
        await processFilesIterator.return();
      }

      for await (let fileInfo of iterate(processFilesOutput)) {
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
      throw ono(error, `An error occurred in ${this} while reading source files.`);
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
