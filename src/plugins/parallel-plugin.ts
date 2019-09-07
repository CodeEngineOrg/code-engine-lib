import { File } from "../files";
import { ParallelPluginSignature, WorkerPool } from "../workers";
import { ParallelPlugin, PluginContext } from "./types";

/**
 * The internal CodeEngine implementation of the `ParallelPlugin` interface.
 * This class runs a plugin in parallel across many worker threads.
 */
export class CodeEngineParallelPlugin implements ParallelPlugin {
  public readonly id: number;
  public readonly name: string;
  public readonly processFile?: (file: File, context: PluginContext) => Promise<void>;
  private _workerPool: WorkerPool;

  public constructor(id: number, signature: ParallelPluginSignature, workerPool: WorkerPool) {
    this._workerPool = workerPool;
    this.id = id;
    this.name = signature.name;

    if (signature.processFile) {
      this.processFile = this._processFile;
    }
  }

  /**
   * Processes the given file on a `CodeEngineWorker`.
   */
  private async _processFile(file: File, context: PluginContext): Promise<void> {
    return this._workerPool.processFile(this.id, file, context);
  }
}
