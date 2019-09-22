// tslint:disable: completed-docs
import { createFilter } from "file-path-filter";
import { ono } from "ono";
import { CodeEngineFileList } from "../files/file-list";
import { File, FileInfo, FileList } from "../files/types";
import { isPlugin } from "../type-guards";
import { WorkerPool } from "../workers/worker-pool";
import { AnyIterator, CanIterate, FileProcessor, FilterFunction, Plugin, PluginContext } from "./types";

type PluginMethod = "processFile" | "processFiles" | "find" | "read" | "watch" | "stopWatching" | "write" | "clean";
const pluginMethods: PluginMethod[] = ["processFile", "processFiles", "find", "read", "watch", "stopWatching", "write", "clean"];

/**
 * The internal CodeEngine implementation of the `Plugin` interface.
 */
export class CodeEnginePlugin {
  public readonly name: string;
  public readonly filter?: FilterFunction;
  private readonly _plugin: Plugin;

  private constructor(plugin: Plugin, defaultName: string) {
    if (!isPlugin(plugin)) {
      throw ono.type(`${plugin} is not a valid CodeEngine plugin.`);
    }

    this.name = plugin.name || defaultName;
    this._plugin = plugin;

    if (plugin.filter !== undefined) {
      this.filter = createFilter({ map }, plugin.filter);
    }

    for (let method of pluginMethods) {
      if (!plugin[method]) {
        this[method] = undefined;
      }
    }
  }

  /**
   * Loads the given `Plugin` or `ModuleDefinition`.
   */
  public static async load(pluginPOJO: Plugin, workerPool: WorkerPool, defaultName: string): Promise<CodeEnginePlugin> {
    let plugin: CodeEnginePlugin;

    try {
      plugin = new CodeEnginePlugin(pluginPOJO, defaultName);

      let { processFile } = pluginPOJO;
      if (typeof processFile === "string" || (typeof processFile === "object" && "moduleId" in processFile)) {
        // The processFile method is implemented as a separate module, so load the module on all worker threads.
        plugin._plugin.processFile = await workerPool.loadModule(processFile);
      }

      return plugin;
    }
    catch (error) {
      throw ono(error, `Error in ${defaultName}.`);
    }
  }

  public async processFile?(file: File, context: PluginContext): Promise<FileList> {
    try {
      let files = new CodeEngineFileList([file]);

      if (this.filter && !this.filter(file, files, context)) {
        return files;
      }

      await (this._plugin.processFile as FileProcessor)(files, context);
      return files;
    }
    catch (error) {
      throw ono(error, { path: file.path }, `An error occurred in ${this} while processing ${file}.`);
    }
  }

  public async processFiles?(files: FileList, context: PluginContext): Promise<void> {
    try {
      if (this.filter) {
        // Temporarily remove the filtered files from the master list
        let filteredFiles = files.remove((file) => this.filter!(file, files, context));

        // Process only the filtered files
        await this._plugin.processFiles!(filteredFiles, context);

        // Now add the filtered files (including any added/removed files) to the master list
        for (let file of filteredFiles) {
          files.add(file);
        }
      }
      else {
        // There is no filter, so process the full list of files
        await this._plugin.processFiles!(files, context);
      }
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing files.`);
    }
  }

  public find?(context: PluginContext): AnyIterator<FileInfo> {
    try {
      let iterable = this._plugin.find!(context);
      return getIterator(iterable);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while searching for source files.`);
    }
  }

  public async read?(file: File, context: PluginContext): Promise<void> {
    try {
      await this._plugin.read!(file, context);
    }
    catch (error) {
      throw ono(error, { path: file.path }, `An error occurred in ${this} while reading ${file}.`);
    }
  }

  public watch?(context: PluginContext): AnyIterator<FileInfo> {
    try {
      let iterable = this._plugin.watch!(context);
      return getIterator(iterable);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while watching source files for changes.`);
    }
  }

  public async stopWatching?(context: PluginContext): Promise<void> {
    try {
      await this._plugin.stopWatching!(context);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while watching source files for changes.`);
    }
  }

  public async write?(file: File, context: PluginContext): Promise<void> {
    try {
      await this._plugin.write!(file, context);
    }
    catch (error) {
      throw ono(error, { path: file.path }, `An error occurred in ${this} while writing ${file} to the destination.`);
    }
  }

  public async clean?(context: PluginContext): Promise<void> {
    try {
      await this._plugin.clean!(context);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while cleaning the destination.`);
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
 * Returns the iterator for the given iterable.
 */
function getIterator<TResult>(canIterate: CanIterate<TResult>): AnyIterator<TResult> {
  let iterator = canIterate as AnyIterator<TResult>;
  let syncIterable = canIterate as Iterable<TResult>;
  let asyncIterable = canIterate as AsyncIterable<TResult>;

  if (typeof asyncIterable[Symbol.asyncIterator] === "function") {
    return asyncIterable[Symbol.asyncIterator]();
  }
  else if (typeof syncIterable[Symbol.iterator] === "function") {
    return syncIterable[Symbol.iterator]();
  }
  else if (typeof iterator.next === "function") {
    return iterator;
  }
  else {
    throw ono.type(`CodeEngine requires an iterable, such as an array, Map, Set, or generator.`);
  }
}


/**
 * Maps `File` objects to paths for filtering
 */
function map(file: File): string {
  return file.path;
}
