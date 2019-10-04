import { AsyncAllIterable, Context, File, PluginDefinition } from "@code-engine/types";
import { WorkerPool } from "@code-engine/workers";
import { EventEmitter } from "events";
import { ono } from "ono";
import { BuildPipeline } from "./build/build-pipeline";
import { Config } from "./config";
import { LogEmitter } from "./log-emitter";
import { normalizePlugin } from "./plugins/normalize-plugin";

/**
 * The main CodeEngine class.
 */
export class CodeEngine extends EventEmitter {
  /** internal */
  private readonly _buildPipeline: BuildPipeline;

  /** internal */
  private readonly _workerPool: WorkerPool;

  /** internal */
  private _isDisposed: boolean = false;

  public constructor(config: Config = {}) {
    super();

    let debug = config.debug === undefined ? Boolean(process.env.DEBUG) : config.debug;

    let context: Context = {
      debug,
      cwd: config.cwd || process.cwd(),
      dev: config.dev === undefined ? process.env.NODE_ENV === "development" : config.dev,
      logger: new LogEmitter(this, debug),
    };

    this._workerPool = new WorkerPool(config.concurrency, context);
    this._workerPool.on("error", (err: Error) => errorHandler(this, err));
    this._buildPipeline = new BuildPipeline(context);
  }

  /**
   * Indicates whether the `dispose()` method has been called.
   * Once disposed, a CodeEngine instance is no longer usable.
   */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Loads one or more CodeEngine plugins.
   */
  public async use(...plugins: PluginDefinition[]): Promise<void> {
    assertNotDisposed(this);

    for (let pluginDefinition of plugins) {
      let defaultName = `Plugin ${this._buildPipeline.size + 1}`;
      let plugin = await normalizePlugin(pluginDefinition, this._workerPool, defaultName);
      this._buildPipeline.add(plugin);
    }
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(): Promise<void> {
    assertNotDisposed(this);
    return this._buildPipeline.clean();
  }

  /**
   * Runs a full build of all source files.
   *
   * @returns - The output files
   */
  public build(): AsyncAllIterable<File> {
    assertNotDisposed(this);
    return this._buildPipeline.build();
  }

  /**
   * Watches source files for changes and runs incremental re-builds whenever changes are detected.
   */
  public async watch(): Promise<void> {
    assertNotDisposed(this);
    return this._buildPipeline.watch();
  }

  /**
   * Releases system resources that are held by this CodeEngine instance.
   * Once `dispose()` is called, the CodeEngine instance is no longer usable.
   */
  public async dispose(): Promise<void> {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    await Promise.all([
      this._buildPipeline.dispose(),
      this._workerPool.dispose(),
    ]);
  }

  /**
   * Returns a string representation of the CodeEngine instance.
   */
  public toString(): string {
    if (this._isDisposed) {
      return `CodeEngine (disposed)`;
    }
    else {
      return `CodeEngine (${this._buildPipeline.size} plugins)`;
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
 * Throws an error if the `CodeEngine` has been disposed.
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
    engine.emit("error", error);
  }
  finally {
    await engine.dispose();
  }
}
