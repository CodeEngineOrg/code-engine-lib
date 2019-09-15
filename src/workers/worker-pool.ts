import { ono } from "ono";
import * as os from "os";
import { CodeEngine } from "../code-engine";
import { CodeEngineWorkerPlugin, WorkerPluginModule } from "../plugins";
import { LoadWorkerPluginInfo } from "./types";
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

  public constructor(engine: CodeEngine, concurrency?: number) {
    this._engine = engine;
    concurrency = concurrency || os.cpus().length;

    for (let i = 0; i < concurrency; i++) {
      let worker = new CodeEngineWorker(engine);
      this._workers.push(worker);
    }
  }

  /**
   * Loads the specified `WorkerPlugin` into all worker threads, and returns a facade that
   * allows it to be used from the main thread like a normal plugin.
   */
  public async loadWorkerPlugin(module: WorkerPluginModule | string, defaultName: string)
  : Promise<CodeEngineWorkerPlugin> {
    this._assertNotDisposed();

    if (typeof module === "string") {
      module = { moduleId: module };
    }

    let info: LoadWorkerPluginInfo = {
      ...module,
      defaultName,
      pluginId: ++pluginCounter,
      cwd: this._engine.cwd,
    };

    let signatures = await Promise.all(
      this._workers.map((worker) => worker.loadWorkerPlugin(info))
    );

    return new CodeEngineWorkerPlugin(info.pluginId, signatures[0], this);
  }

  /**
   * Selects a `CodeEngineWorker` from the pool to perform a task.
   */
  public select(): CodeEngineWorker {
    // For now, we just use a simple round-robin strategy,
    // but we may employ a more advanced selection strategy later
    return this._workers[roundRobinCounter++ % this._workers.length];
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
      throw ono(`CodeEngine cannot be used after it has been disposed.`);
    }
  }
}
