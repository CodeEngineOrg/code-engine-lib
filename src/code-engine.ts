import { EventEmitter } from "events";
import { build } from "./build/build";
import { FileList } from "./files/types";
import { LogEmitter } from "./loggers/log-emitter";
import { Logger } from "./loggers/types";
import { CodeEnginePluginContext } from "./plugins/context";
import { CodeEnginePlugin } from "./plugins/plugin";
import { Plugin, PluginContext } from "./plugins/types";
import { isDestinationCleaner } from "./type-guards";
import { Config, Event } from "./types";
import { WorkerPool } from "./workers/worker-pool";

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
    plugins: CodeEnginePlugin[];
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
  public async use(...plugins: Plugin[]): Promise<void>;
  public async use(plugins: Plugin[]): Promise<void>;
  public async use(...arg1: Array<Plugin | Plugin[]>): Promise<void> {
    let { plugins, workerPool } = this[_internal];
    let pluginPOJOs: Plugin[] = arg1.flat();

    workerPool.assertNotDisposed();

    for (let pluginPOJO of pluginPOJOs) {
      let defaultName = `Plugin ${plugins.length + 1}`;
      let plugin = await CodeEnginePlugin.load(pluginPOJO, workerPool, defaultName);
      plugins.push(plugin);
    }
  }

  /**
   * Deletes the contents of the destination.
   */
  public async clean(): Promise<void> {
    let { plugins, workerPool } = this[_internal];
    workerPool.assertNotDisposed();
    let cleaners = plugins.filter(isDestinationCleaner);
    let context = new CodeEnginePluginContext(this);
    await Promise.all(cleaners.map((cleaner) => cleaner.clean(context)));
  }

  /**
   * Runs a full build of all source files.
   *
   * @returns - The output files
   */
  public async build(): Promise<FileList> {
    let { plugins, workerPool } = this[_internal];
    workerPool.assertNotDisposed();
    let context = new CodeEnginePluginContext(this);
    return build(plugins, context);
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
