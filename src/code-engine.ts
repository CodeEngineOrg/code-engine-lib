import { EventEmitter } from "events";
import { ono } from "ono";
import { build } from "./build";
import { FileList } from "./files";
import { LogEmitter } from "./loggers";
import { Logger } from "./loggers/types";
import { CodeEnginePluginContext, isDestinationCleaner, isPlugin, Plugin, PluginContext, UsePlugin } from "./plugins";
import { Config, Event } from "./types";
import { WorkerPool } from "./workers";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * The main CodeEngine class.
 */
export class CodeEngine extends EventEmitter {
  public readonly cwd: string;
  public readonly dev: boolean;
  public readonly debug: boolean;
  public readonly logger: Logger;
  private readonly [_internal]: {
    plugins: Plugin[];
    readonly context: PluginContext;
    readonly workerPool: WorkerPool;
  };

  public constructor(config: Config = {}) {
    super();

    this.cwd = config.cwd || process.cwd();
    this.dev = config.dev === undefined ? process.env.NODE_ENV === "development" : config.dev;
    this.debug = config.debug === undefined ? Boolean(process.env.DEBUG) : config.debug;
    this.logger = new LogEmitter(this, this.debug);

    Object.defineProperty(this, _internal, { value: {
      context,
      plugins: [],
      workerPool: new WorkerPool(this, config.concurrency),
    }});
  }

  /**
   * Indicates whether the `dispose()` method has been called.
   * Once disposed, a CodeEngine instance is no longer usable.
   */
  public get isDisposed(): boolean {
    return this[_internal].workerPool.isDisposed;
  }

  /**
   * Loads one or more CodeEngine plugins.
   */
  public async use(...plugins: UsePlugin[]): Promise<void>;
  public async use(plugins: UsePlugin[]): Promise<void>;
  public async use(...arg1: Array<UsePlugin | UsePlugin[]>): Promise<void> {
    let plugins: UsePlugin[] = arg1.flat();

    for (let plugin of plugins) {
      let defaultName = `Plugin ${this[_internal].plugins.length + 1}`;

      if (typeof plugin === "string" || "moduleId" in plugin) {
        // This is a worker plugin, so load it into the worker threads
        plugin = await this[_internal].workerPool.loadWorkerPlugin(plugin, defaultName);
      }
      else {
        plugin.name = plugin.name || defaultName;
      }

      if (!isPlugin(plugin)) {
        throw ono.type(`${plugin} is not a valid CodeEngine plugin.`);
      }

      this[_internal].plugins.push(plugin);
    }
  }

  /**
   * Deletes the contents of the destination.
   */
  public async clean(): Promise<void> {
    let cleaners = this[_internal].plugins.filter(isDestinationCleaner);
    let context = new CodeEnginePluginContext(this);
    await Promise.all(cleaners.map((cleaner) => cleaner.clean(context)));
  }

  /**
   * Runs a full build of all source files.
   *
   * @returns - The output files
   */
  public async build(): Promise<FileList> {
    let context = new CodeEnginePluginContext(this);
    return build(this[_internal].plugins, context);
  }

  /**
   * Releases system resources that are held by this CodeEngine instance.
   * Once `dispose()` is called, the CodeEngine instance is no longer usable.
   */
  public async dispose(): Promise<void> {
    this[_internal].plugins = [];
    await this[_internal].workerPool.dispose();
  }

  /**
   * Emits an "error" event and disposes this CodeEngine instance.
   *
   * @internal
   */
  public error(error: Error): void {
    this.emit(Event.Error, error);
    this.dispose();  // tslint:disable-line: no-floating-promises
  }

  /**
   * Returns a string representation of the CodeEngine instance.
   */
  public toString(): string {
    let { plugins, workerPool } = this[_internal];

    if (workerPool.isDisposed) {
      return `CodeEngine (disposed)`;
    }
    else {
      return `CodeEngine (${plugins.length} plugins)`;
    }
  }

  /**
   * Returns the name to use for `Object.toString()`.
   */
  public get [Symbol.toStringTag](): string {
    return "CodeEngine";
  }
}
