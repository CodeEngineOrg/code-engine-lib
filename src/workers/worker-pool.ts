import { EventEmitter } from "events";
import * as os from "os";
import { Context, FileProcessor, ModuleDefinition } from "../plugins/types";
import { Event } from "../types";
import { LoadModuleData } from "./types";
import { CodeEngineWorker } from "./worker";

let moduleCounter = 0;
let roundRobinCounter = 0;

/**
 * Manages the CodeEngine worker threads.
 */
export class WorkerPool extends EventEmitter {
  private _cwd: string;
  private _workers: CodeEngineWorker[] = [];

  public constructor(concurrency: number | undefined, context: Context) {
    super();
    this._cwd = context.cwd;
    concurrency = concurrency || os.cpus().length;

    // Re-emit all errros from workers
    let emitError = (error: Error) => this.emit(Event.Error, error);

    for (let i = 0; i < concurrency; i++) {
      let worker = new CodeEngineWorker(context);
      worker.on(Event.Error, emitError);
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
      cwd: this._cwd,
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
