import { BuildSummary, CodeEngineEventEmitter, Context, EventName, Logger, ModuleDefinition, PluginDefinition } from "@code-engine/types";
import { createLogEmitter } from "@code-engine/utils";
import { validate } from "@code-engine/validate";
import { WorkerPool } from "@code-engine/workers";
import { EventEmitter } from "events";
import { ono } from "ono";
import * as os from "os";
import { BuildPipeline } from "./build/build-pipeline";
import { Config } from "./config";
import { normalizePlugin } from "./plugins/normalize-plugin";
import { PluginController } from "./plugins/plugin-controller";

const instances: CodeEngine[] = [];

// Hacky workaround to inherit from EventEmitter while also implementing the CodeEngineEventEmitter interface
const codeEngineEventEmitter = EventEmitter as unknown as (new() => CodeEngineEventEmitter);

/**
 * The main CodeEngine class.
 */
export class CodeEngine extends codeEngineEventEmitter {
  /** @internal */
  private _isDisposed: boolean = false;

  /** @internal */
  private _context: Context;

  /** @internal */
  private readonly _buildPipeline: BuildPipeline;

  /** @internal */
  private readonly _workerPool: WorkerPool;

  public constructor(config: Config = {}) {
    super();

    let context: Context = {
      cwd: config.cwd || process.cwd(),
      concurrency: validate.number.integer.positive(config.concurrency, "concurrency", os.cpus().length),
      dev: config.dev === undefined ? process.env.NODE_ENV === "development" : config.dev,
      debug: config.debug === undefined ? Boolean(process.env.DEBUG) : config.debug,
      log: (undefined as unknown as Logger),
    };

    createLogEmitter(this, context);

    this._context = context;
    this._buildPipeline = new BuildPipeline(this);
    this._workerPool = new WorkerPool(this, context);

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
    this._assertNotDisposed();

    for (let pluginDefinition of plugins) {
      // Normalize the plugin
      let defaultName = `Plugin ${this._buildPipeline.size + 1}`;
      let plugin = await normalizePlugin(pluginDefinition, this._workerPool, defaultName);
      let controller = new PluginController(plugin);

      // Register any event handlers
      controller.onBuildStarting && this.on(EventName.BuildStarting, controller.onBuildStarting.bind(controller));
      controller.onBuildFinished && this.on(EventName.BuildFinished, controller.onBuildFinished.bind(controller));
      controller.onFileChanged && this.on(EventName.FileChanged, controller.onFileChanged.bind(controller));
      controller.onError && this.on(EventName.Error, controller.onError.bind(controller));
      controller.onLog && this.on(EventName.Log, controller.onLog.bind(controller));

      // Add the plugin to the build pipeline
      this._buildPipeline.add(controller);
    }
  }

  /**
   * Imports one or more JavaScript modules in all worker threads.
   */
  public async import(...modules: Array<string | ModuleDefinition<void>>): Promise<void> {
    this._assertNotDisposed();

    for (let moduleDefinition of modules) {
      await this._workerPool.importModule(moduleDefinition);
    }
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(): Promise<void> {
    this._assertNotDisposed();
    let context = { ...this._context };
    return this._buildPipeline.clean(context);
  }

  /**
   * Runs a full build of all source files.
   */
  public async build(): Promise<BuildSummary> {
    this._assertNotDisposed();
    let context = { ...this._context };

    try {
      let summary = await this._buildPipeline.build(context);
      return summary;
    }
    catch (error) {
      // Emit the "Error" event if there are any handlers registered
      if (this.listenerCount(EventName.Error) > 0) {
        this.emit(EventName.Error, error as Error, context);
      }

      // Re-throw the error, regardless of whether there were event handlers
      throw error;
    }
  }

  /**
   * Watches source files for changes and runs incremental re-builds whenever changes are detected.
   *
   * @param delay
   * The time (in milliseconds) to wait after a file change is detected before starting a build.
   * This allows multiple files that are changed together to all be re-built together.
   */
  public watch(delay?: number): void {
    delay = validate.number.integer.positive(delay, "watch delay", 300);
    this._assertNotDisposed();

    let context = { ...this._context };
    this._buildPipeline.watch(delay, context);
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

    let context = { ...this._context };
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
   * Throws an error if the `CodeEngine` has been disposed.
   * @internal
   */
  private _assertNotDisposed() {
    if (this.isDisposed) {
      throw ono(`CodeEngine cannot be used after it has been disposed.`);
    }
  }
}
