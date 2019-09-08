import { ono } from "ono";
import * as os from "os";
import { CodeEngine } from "../code-engine";
import { CodeEngineParallelPlugin, ParallelPlugin, ParallelPluginMethod, ParallelPluginModule } from "../plugins";
import { LoadParallelPluginInfo, WorkerPoolConfig } from "./types";
import { CodeEngineWorker } from "./worker";

let pluginCounter = 0;
let roundRobinCounter = 0;

/**
 * Manages the CodeEngine worker threads.
 */
export class WorkerPool {
  private _engine: CodeEngine;
  private _workers: CodeEngineWorker[] = [];
  private _isDisposed = false;

  public constructor({ cwd, concurrency, engine }: WorkerPoolConfig) {
    this._engine = engine;
    concurrency = concurrency || os.cpus().length;

    for (let i = 0; i < concurrency; i++) {
      let worker = new CodeEngineWorker({ cwd, engine });
      this._workers.push(worker);
    }
  }

  /**
   * The number of workers in the pool.
   */
  public get size(): number {
    return this._workers.length;
  }

  /**
   * Loads the specified `ParallelPlugin` into all worker threads, and returns a facade that
   * allows it to be used from the main thread like a normal plugin.
   */
  public async loadParallelPlugin(module: ParallelPluginModule | string): Promise<ParallelPlugin> {
    this._assertNotDisposed();

    if (typeof module === "string") {
      module = { moduleId: module };
    }

    let info: LoadParallelPluginInfo = {
      ...module,
      pluginId: ++pluginCounter,
    };

    let signatures = await Promise.all(
      this._workers.map((worker) => worker.loadParallelPlugin(info))
    );

    return new CodeEngineParallelPlugin(info.pluginId, signatures[0], this);
  }

  /**
   * Executes the specified plugin method on a `CodeEngineWorker` in the pool.
   */
  public async execPlugin<T>(pluginId: number, method: ParallelPluginMethod,  ...args: unknown[]): Promise<T> {
    // Choose which worker should execute the plugin.
    // NOTE: For now, we just use a simple round-robin strategy, but we may employ a more advanced selection strategy later
    let worker = this._workers[roundRobinCounter++ % this._workers.length];

    return worker.execPlugin<T>(pluginId, method, args);
  }

  /**
   * Indicates whether the `dispose()` method has been called.
   */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Terminates all worker threads.
   */
  public async dispose(): Promise<void> {
    if (this._isDisposed) {
      return;
    }

    this._isDisposed = true;
    let workers = this._workers;
    this._workers = [];
    await Promise.all(workers.map((worker) => worker.terminate()));
  }

  /**
   * Throws an error if the `WorkerPool` has been disposed.
   */
  private _assertNotDisposed() {
    if (this._isDisposed) {
      throw ono(`CodeEngine cannot be used once it has been disposed.`);
    }
  }
}
