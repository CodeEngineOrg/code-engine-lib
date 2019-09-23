import { EventEmitter } from "events";
import { ono } from "ono";
import { Build } from "./build/build";
import { FileList } from "./files/types";
import { LogEmitter } from "./loggers/log-emitter";
import { Logger } from "./loggers/types";
import { CodeEnginePlugin } from "./plugins/plugin";
import { Plugin } from "./plugins/types";
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
    isDisposed: boolean;
    readonly build: Build;
    readonly workerPool: WorkerPool;
  };

  public constructor(config: Config = {}) {
    super();

    this.cwd = config.cwd || process.cwd();
    this.dev = config.dev === undefined ? process.env.NODE_ENV === "development" : config.dev;
    this.debug = config.debug === undefined ? Boolean(process.env.DEBUG) : config.debug;
    this.logger = new LogEmitter(this, this.debug);

    Object.defineProperty(this, _internal, { value: {
      isDisposed: false,
      build: new Build(this),
      workerPool: new WorkerPool(this, config.concurrency),
    }});
  }

  /**
   * Indicates whether the `dispose()` method has been called.
   * Once disposed, a CodeEngine instance is no longer usable.
   */
  public get isDisposed(): boolean {
    return this[_internal].isDisposed;
  }

  /**
   * Loads one or more CodeEngine plugins.
   */
  public async use(...plugins: Plugin[]): Promise<void>;
  public async use(plugins: Plugin[]): Promise<void>;
  public async use(...arg1: Array<Plugin | Plugin[]>): Promise<void> {
    let { build, workerPool } = this[_internal];
    let pluginPOJOs: Plugin[] = arg1.flat();

    this._assertNotDisposed();

    for (let pluginPOJO of pluginPOJOs) {
      let defaultName = `Plugin ${build.plugins.length + 1}`;
      let plugin = await CodeEnginePlugin.load(pluginPOJO, workerPool, defaultName);
      build.plugins.push(plugin);
    }
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(): Promise<void> {
    this._assertNotDisposed();
    return this[_internal].build.clean();
  }

  /**
   * Runs a full build of all source files.
   *
   * @returns - The output files
   */
  public async build(): Promise<FileList> {
    this._assertNotDisposed();
    return this[_internal].build.build();
  }

  /**
   * Runs a full build of all source files, and runs incremental re-builds whenever
   * source files change.
   */
  public async watch(): Promise<void> {
    this._assertNotDisposed();
    return this[_internal].build.watch();
  }

  /**
   * Releases system resources that are held by this CodeEngine instance.
   * Once `dispose()` is called, the CodeEngine instance is no longer usable.
   */
  public async dispose(): Promise<void> {
    if (this[_internal].isDisposed) {
      return;
    }

    this[_internal].isDisposed = true;
    await this[_internal].build.dispose();
    await this[_internal].workerPool.dispose();
  }

  /**
   * Returns a string representation of the CodeEngine instance.
   */
  public toString(): string {
    let { isDisposed, build } = this[_internal];

    if (isDisposed) {
      return `CodeEngine (disposed)`;
    }
    else {
      return `CodeEngine (${build.plugins.length} plugins)`;
    }
  }

  /**
   * Returns the name to use for `Object.toString()`.
   */
  public get [Symbol.toStringTag](): string {
    return "CodeEngine";
  }

  /**
   * Emits an "error" event and disposes this CodeEngine instance.
   *
   * @internal
   */
  public _error(error: Error): void {
    this.emit(Event.Error, error);
    this.dispose();  // tslint:disable-line: no-floating-promises
  }

  /**
   * Throws an error if the `WorkerPool` has been disposed.
   */
  private _assertNotDisposed() {
    if (this[_internal].isDisposed) {
      throw ono(`CodeEngine cannot be used after it has been disposed.`);
    }
  }
}
