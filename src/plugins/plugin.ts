// tslint:disable: completed-docs
import { ono } from "ono";
import { File, FileInfo, FileList } from "../files";
import { WorkerPool } from "../workers";
import { isPlugin, pluginMethods } from "./internal-types";
import { AnyIterator, CanIterate, Plugin, PluginContext, UsePlugin } from "./types";

/**
 * The internal CodeEngine implementation of the `Plugin` interface.
 */
export class CodeEnginePlugin implements Plugin {
  public readonly name: string;
  private readonly _plugin: Plugin;

  public constructor(plugin: Plugin, defaultName: string) {
    if (!isPlugin(plugin)) {
      throw ono.type(`${plugin} is not a valid CodeEngine plugin.`);
    }

    this.name = plugin.name || defaultName;
    this._plugin = plugin;

    for (let method of pluginMethods) {
      if (!plugin[method]) {
        this[method] = undefined;
      }
    }
  }

  /**
   * Loads the given `Plugin` or `WorkerPluginModule`.
   */
  public static async load(plugin: UsePlugin, workerPool: WorkerPool, defaultName: string): Promise<CodeEnginePlugin> {
    if (typeof plugin === "string" || (typeof plugin === "object" && "moduleId" in plugin)) {
      // This is a worker plugin, so load it into the worker threads
      return workerPool.loadWorkerPlugin(plugin, defaultName);
    }
    else {
      return new CodeEnginePlugin(plugin, defaultName);
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

  public async read?(file: File, context: PluginContext): Promise<undefined | string | Buffer> {
    try {
      return await this._plugin.read!(file, context);
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

  public async processFile?(file: File, context: PluginContext): Promise<void> {
    try {
      await this._plugin.processFile!(file, context);
    }
    catch (error) {
      throw ono(error, { path: file.path }, `An error occurred in ${this} while processing ${file}.`);
    }
  }

  public async processAllFiles?(files: FileList, context: PluginContext): Promise<void> {
    try {
      await this._plugin.processAllFiles!(files, context);
    }
    catch (error) {
      throw ono(error, `An error occurred in ${this} while processing files.`);
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
