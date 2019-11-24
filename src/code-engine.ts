import { BuildSummary, Context, EventName, Logger, PluginDefinition } from "@code-engine/types";
import { validate } from "@code-engine/validate";
import { WorkerPool } from "@code-engine/workers";
import { EventEmitter } from "events";
import { ono } from "ono";
import * as os from "os";
import { BuildPipeline } from "./build/build-pipeline";
import { Config } from "./config";
import { LogEmitter } from "./log-emitter";
import { normalizePlugin } from "./plugins/normalize-plugin";
import { PluginController } from "./plugins/plugin-controller";

const instances: CodeEngine[] = [];

/**
 * The main CodeEngine class.
 */
export class CodeEngine extends EventEmitter {
  /** @internal */
  private _isDisposed: boolean = false;

  /** @internal */
  private _config: Required<Config>;

  /** @internal */
  private _logger: Logger;

  /** @internal */
  private readonly _buildPipeline: BuildPipeline;

  /** @internal */
  private readonly _workerPool: WorkerPool;

  public constructor(config: Config = {}) {
    super();

    this._config = {
      cwd: config.cwd || process.cwd(),
      concurrency: validate.number.integer.positive(config.concurrency, "concurrency", os.cpus().length),
      watchDelay: validate.number.integer.positive(config.watchDelay, "watchDelay", 300),
      dev: config.dev === undefined ? process.env.NODE_ENV === "development" : config.dev,
      debug: config.debug === undefined ? Boolean(process.env.DEBUG) : config.debug,
    };

    this._logger = new LogEmitter(this, this._config.debug);

    this._buildPipeline = new BuildPipeline();
    this._buildPipeline.on(EventName.BuildStarting, this.emit.bind(this, EventName.BuildStarting));
    this._buildPipeline.on(EventName.BuildFinished, this.emit.bind(this, EventName.BuildFinished));
    this._buildPipeline.on(EventName.Error, this.emit.bind(this, EventName.Error));

    this._workerPool = new WorkerPool(this._config.concurrency, this._createContext());
    this._workerPool.on(EventName.Error, (err: Error) => crashHandler(this, err));

    instances.push(this);
  }

  /**
   * Returns all CodeEngine instances that have been created and not yet disposed.
   */
  public static get instances(): ReadonlyArray<CodeEngine> {
    return instances.slice();
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
      let controller = new PluginController(plugin);
      this._buildPipeline.add(controller);
    }
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(): Promise<void> {
    assertNotDisposed(this);
    let context = this._createContext();
    return this._buildPipeline.clean(context);
  }

  /**
   * Runs a full build of all source files.
   */
  public async build(): Promise<BuildSummary> {
    assertNotDisposed(this);
    let context = this._createContext();
    return this._buildPipeline.build(this._config.concurrency, context);
  }

  /**
   * Watches source files for changes and runs incremental re-builds whenever changes are detected.
   */
  public watch(): void {
    assertNotDisposed(this);
    let context = this._createContext();
    let { watchDelay, concurrency } = this._config;
    this._buildPipeline.watch(watchDelay, concurrency, context);
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

    let index = instances.indexOf(this);
    index >= 0 && instances.splice(index, 1);

    let context = this._createContext();
    await Promise.all([
      this._buildPipeline.dispose(context),
      this._workerPool.dispose(),
    ]);
  }

  /**
   * Disposes all CodeEngine instances.
   */
  // tslint:disable-next-line: member-ordering
  public static async disposeAll(): Promise<void> {
    await Promise.all(
      instances.splice(0, instances.length).map((engine) => engine.dispose())
    );
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

  /**
   * Creates a `Context` object for this CodeEngine instance.
   * @internal
   */
  private _createContext(): Context {
    let { cwd, concurrency, dev, debug } = this._config;
    let logger = this._logger;
    return { cwd, concurrency, dev, debug, logger };
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
async function crashHandler(engine: CodeEngine, error: Error) {
  try {
    engine.emit(EventName.Error, error);
  }
  finally {
    await engine.dispose();
  }
}
