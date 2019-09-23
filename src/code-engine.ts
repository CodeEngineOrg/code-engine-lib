import { EventEmitter } from "events";
import { ono } from "ono";
import { Build } from "./build/build";
import { File } from "./files/types";
import { LogEmitter } from "./loggers/log-emitter";
import { normalizePlugin } from "./plugins/normalize-plugin";
import { CodeEnginePlugin } from "./plugins/plugin";
import { Context, PluginDefinition } from "./plugins/types";
import { AsyncAllIterable, Config, Event } from "./types";
import { WorkerPool } from "./workers/worker-pool";

const _internal = Symbol("Internal CodeEngine Properties");

interface Internal {
  readonly build: Build;
  readonly workerPool: WorkerPool;
  isDisposed: boolean;
}

/**
 * The main CodeEngine class.
 */
export class CodeEngine extends EventEmitter {
  private readonly [_internal]: Internal;

  public constructor(config: Config = {}) {
    super();

    let debug = config.debug === undefined ? Boolean(process.env.DEBUG) : config.debug;

    let context: Context = {
      debug,
      cwd: config.cwd || process.cwd(),
      dev: config.dev === undefined ? process.env.NODE_ENV === "development" : config.dev,
      logger: new LogEmitter(this, debug),
    };

    let workerPool = new WorkerPool(config.concurrency, context);
    workerPool.on(Event.Error, (err: Error) => errorHandler(this, err));

    let internal: Internal = {
      workerPool,
      isDisposed: false,
      build: new Build(context),
    };

    Object.defineProperty(this, _internal, { value: internal });
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
  public async use(...plugins: PluginDefinition[]): Promise<void> {
    let { build, workerPool } = this[_internal];

    assertNotDisposed(this);

    for (let pluginDefinition of plugins) {
      let defaultName = `Plugin ${build.plugins.length + 1}`;
      let plugin = await normalizePlugin(pluginDefinition, workerPool, defaultName);
      build.plugins.push(new CodeEnginePlugin(plugin));
    }
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(): Promise<void> {
    assertNotDisposed(this);
    return this[_internal].build.clean();
  }

  /**
   * Runs a full build of all source files.
   *
   * @returns - The output files
   */
  public async build(): Promise<FileList> {
    assertNotDisposed(this);
    return this[_internal].build.build();
  }

  /**
   * Runs a full build of all source files, and runs incremental re-builds whenever
   * source files change.
   */
  public async watch(): Promise<void> {
    assertNotDisposed(this);
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
}

/**
 * Throws an error if the `WorkerPool` has been disposed.
 */
function assertNotDisposed(engine: CodeEngine) {
  if (engine.isDisposed) {
    throw ono(`CodeEngine cannot be used after it has been disposed.`);
  }
}

/**
 * Handles unexpected errors, such as worker threads crashing.
 */
async function errorHandler(engine: CodeEngine, error: Error) {
  try {
    engine.emit(Event.Error, error);
  }
  finally {
    await engine.dispose();
  }
}
