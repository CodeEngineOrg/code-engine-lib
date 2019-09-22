import * as os from "os";
import { CodeEngine } from "../code-engine";
import { FileProcessor, ModuleDefinition } from "../plugins/types";
import { LoadModuleData } from "./types";
import { CodeEngineWorker } from "./worker";

let moduleCounter = 0;
let roundRobinCounter = 0;

/**
 * Manages the CodeEngine worker threads.
 */
export class WorkerPool {
  private _engine: CodeEngine;
  private _workers: CodeEngineWorker[] = [];

  public constructor(engine: CodeEngine, concurrency?: number) {
    this._engine = engine;
    concurrency = concurrency || os.cpus().length;

    for (let i = 0; i < concurrency; i++) {
      let worker = new CodeEngineWorker(engine);
      this._workers.push(worker);
    }
  }

  /**
   * Loads the specified JavaScript module into all worker threads.
   */
  public async loadModule(module: ModuleDefinition | string): Promise<FileProcessor> {
    if (typeof module === "string") {
      module = { moduleId: module };
    }

    let data: LoadModuleData = {
      ...module,
      id: ++moduleCounter,
      cwd: this._engine.cwd,
    };

    await Promise.all(
      this._workers.map((worker) => worker.loadModule(data))
    );

    return this._createFileProcessor(data.id);
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
   * Terminates all worker threads.
   */
  public async dispose(): Promise<void> {
    let workers = this._workers;
    this._workers = [];
    await Promise.all(workers.map((worker) => worker.terminate()));
  }

  /**
   * Creates a `FileProcessor` function that marshalls to a worker in the pool.
   */
  private _createFileProcessor(id: number): FileProcessor {
    return (files, context) => {
      // Select a worker from the pool to process the files
      let worker = this.select();
      return worker.processFiles(id, files, context);
    };
  }
}
