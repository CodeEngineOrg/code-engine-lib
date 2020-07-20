import { Cloneable, CodeEngine as ICodeEngine, CodeEngineEventEmitter, EventName, Logger, PluginDefinition, Summary } from "@code-engine/types";
import { createLogEmitter } from "@code-engine/utils";
import { assert } from "@jsdevtools/assert";
import { WorkerPool } from "@code-engine/workers";
import { ono } from "@jsdevtools/ono";
import { EventEmitter } from "events";
import * as os from "os";
import { Config } from "./config";
import { mountPlugin } from "./plugins/mount";
import { PluginController } from "./plugins/plugin-controller";
import { Pipeline } from "./run/pipeline";

const instances: CodeEngine[] = [];

// Hacky workaround to inherit from EventEmitter while also implementing the CodeEngineEventEmitter interface
const codeEngineEventEmitter = EventEmitter as unknown as (new() => CodeEngineEventEmitter);

/**
 * The main CodeEngine class.
 */
export class CodeEngine extends codeEngineEventEmitter implements ICodeEngine {
  /** @internal */
  private _cwd: string;

  /** @internal */
  private _concurrency: number;

  /** @internal */
  private _dev: boolean;

  /** @internal */
  private _debug: boolean;

  /** @internal */
  private _disposed = false;

  /** @internal */
  private _log: Logger;

  /** @internal */
  private readonly _pipeline: Pipeline;

  /** @internal */
  private readonly _workerPool: WorkerPool;

  public constructor(config: Config = {}) {
    super();

    this._cwd = config.cwd || process.cwd();
    this._concurrency = assert.number.integer.positive(config.concurrency, "concurrency", os.cpus().length);
    this._dev = config.dev === undefined ? process.env.NODE_ENV === "development" : config.dev;
    this._debug = config.debug === undefined ? Boolean(process.env.DEBUG) : config.debug;
    this._log = createLogEmitter(this, this.debug);
    this._pipeline = new Pipeline(this);
    this._workerPool = new WorkerPool(this);

    instances.push(this);
  }

  /**
   * Returns all CodeEngine instances that have been created and not yet disposed.
   */
  public static get instances(): readonly CodeEngine[] {
    return instances.slice();
  }

  /**
   * The directory that should be used to resolve all relative paths.
   */
  public get cwd(): string {
    return this._cwd;
  }

  /**
   * The number of files that CodeEngine can process concurrently.
   */
  public get concurrency(): number {
    return this._concurrency;
  }

  /**
   * Indicates whether CodeEngine is running in local development mode.
   * When `true`, plugins should generate files that are un-minified, un-obfuscated, and may
   * contain references to localhost.
   */
  public get dev(): boolean {
    return this._dev;
  }

  /**
   * Indicates whether CodeEngine is running in debug mode, which enables additional logging
   * and error stack traces.
   */
  public get debug(): boolean {
    return this._debug;
  }

  /**
   * Indicates whether the `dispose()` method has been called.
   * Once disposed, the CodeEngine instance is no longer usable.
   */
  public get disposed(): boolean {
    return this._disposed;
  }

  /**
   * logs messages and errors
   */
  public get log(): Logger {
    return this._log;
  }

  /**
   * Loads one or more CodeEngine plugins.
   */
  public async use(...plugins: PluginDefinition[]): Promise<void> {
    this._assertNotDisposed();

    for (let pluginDefinition of plugins) {
      // Normalize the plugin
      let defaultName = `Plugin ${this._pipeline.size + 1}`;
      let plugin = await mountPlugin(this, this._workerPool, pluginDefinition, defaultName);
      let controller = new PluginController(plugin);

      // Add the plugin to the pipeline
      this._pipeline.add(controller);

      // Initialize the plugin, if necessary
      if (controller.initialize) {
        await controller.initialize();
      }
    }
  }

  /**
   * Imports one or more JavaScript modules in all worker threads.
   */
  public async import(moduleId: string, data?: Cloneable): Promise<void> {
    this._assertNotDisposed();
    await this._workerPool.importModule(moduleId, data);
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(): Promise<void> {
    this._assertNotDisposed();
    return this._pipeline.clean();
  }

  /**
   * Runs CodeEngine, processing all source files using all currently-loaded plugins.
   */
  public async run(): Promise<Summary> {
    this._assertNotDisposed();

    try {
      let summary = await this._pipeline.run();
      return summary;
    }
    catch (error) {
      // Emit the "Error" event if there are any handlers registered
      if (this.listenerCount(EventName.Error) > 0) {
        this.emit(EventName.Error, error as Error);
      }

      // Re-throw the error, regardless of whether there were event handlers
      throw error;
    }
  }

  /**
   * Watches source files for changes and performs incremental runs whenever changes are detected.
   *
   * @param delay
   * The time (in milliseconds) to wait after a file change is detected before starting a run.
   * This allows multiple files that are changed together to all be re-built together.
   */
  public watch(delay?: number): void {
    delay = assert.number.integer.positive(delay, "watch delay", 300);
    this._assertNotDisposed();

    this._pipeline.watch(delay);
  }

  /**
   * Releases system resources that are held by this CodeEngine instance.
   * Once `dispose()` is called, the CodeEngine instance is no longer usable.
   */
  public async dispose(): Promise<void> {
    if (this._disposed) {
      return;
    }

    this._disposed = true;

    let index = instances.indexOf(this);
    index >= 0 && instances.splice(index, 1);

    await Promise.all([
      this._pipeline.dispose(),
      this._workerPool.dispose(),
    ]);
  }

  /**
   * Disposes all CodeEngine instances.
   */
  public static async disposeAll(): Promise<void> {
    await Promise.all(
      instances.splice(0, instances.length).map((engine) => engine.dispose())
    );
  }

  /**
   * Returns a string representation of the CodeEngine instance.
   */
  public toString(): string {
    if (this._disposed) {
      return "CodeEngine (disposed)";
    }
    else {
      return `CodeEngine (${this._pipeline.size} plugins)`;
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
    if (this.disposed) {
      throw ono("CodeEngine cannot be used after it has been disposed.");
    }
  }
}
