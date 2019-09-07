import { EventEmitter } from "events";
import { build } from "./build";
import { FileList } from "./files";
import { LogEmitter } from "./loggers";
import { Logger } from "./loggers/types";
import { CodeEngineContext, isDestinationCleaner, Plugin, UsePlugin } from "./plugins";
import { Config, Event } from "./types";
import { WorkerPool } from "./workers";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * The main CodeEngine class.
 */
export class CodeEngine extends EventEmitter {
  public readonly logger: Logger;
  private readonly [_internal]: {
    plugins: Plugin[];
    readonly workerPool: WorkerPool;
  };

  public constructor(config: Config = {}) {
    super();

    Object.defineProperty(this, _internal, { value: {
      plugins: [],
      workerPool: new WorkerPool(this, config),
    }});

    this.logger = new LogEmitter(this);
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
      if (typeof plugin === "string" || "module" in plugin) {
        // This is a parallel plugin, so load it into the worker threads
        plugin = await this[_internal].workerPool.loadParallelPlugin(plugin);
      }

      this[_internal].plugins.push(plugin);
    }
  }

  /**
   * Deletes the contents of the destination.
   */
  public async clean(): Promise<void> {
    let cleaners = this[_internal].plugins.filter(isDestinationCleaner);
    let context = new CodeEngineContext(this);
    await Promise.all(cleaners.map((cleaner) => cleaner.clean(context)));
  }

  /**
   * Runs a full build of all source files.
   *
   * @returns - The output files
   */
  public async build(): Promise<FileList> {
    let context = new CodeEngineContext(this);
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
