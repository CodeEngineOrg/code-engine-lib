import * as os from "os";
import { CodeEngine } from "../code-engine";
import { ParallelPlugin, ParallelPluginModule } from "../plugins";
import { Config } from "../types";
import { CodeEngineWorker } from "./worker";

/**
 * Manages the CodeEngine worker threads.
 */
export class WorkerPool {
  private _engine: CodeEngine;
  private _workers: CodeEngineWorker[] = [];
  private _isDisposed = false;

  public constructor(engine: CodeEngine, { concurrency }: Config) {
    this._engine = engine;
    concurrency = concurrency || os.cpus().length;

    for (let i = 0; i < concurrency; i++) {
      let worker = new CodeEngineWorker(engine);
      this._workers.push(worker);
    }
  }

  /**
   * Loads the specified `ParallelPlugin` into all worker threads, and returns a facade that
   * allows it to be used from the main thread like a normal plugin.
   */
  public async loadParallelPlugin(module: ParallelPluginModule | string): Promise<ParallelPlugin> {
    this._assertNotDisposed();

    if (typeof module === "string") {
      module = { module };
    }

    return import(module.module);
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
    await Promise.all(this._workers.map((worker) => worker.terminate()));
  }

  /**
   * Throws an error if the `WorkerPool` has been disposed.
   */
  private _assertNotDisposed() {
    if (this._isDisposed) {
      throw new Error(`CodeEngine cannot be used once it has been disposed.`);
    }
  }
}
