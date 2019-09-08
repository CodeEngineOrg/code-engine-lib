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
  private _workerPool: WorkerPool;

  public constructor(id: number, signature: ParallelPluginSignature, workerPool: WorkerPool) {
    this.id = id;
    this.name = signature.name;
    this._workerPool = workerPool;

    // Remove any methods that aren't in the plugin signature
    if (!signature.processFile) {
      this.processFile = undefined;
    }
  }

  /**
   * Processes the given file on a `CodeEngineWorker`.
   */
  public async processFile?(file: File, context: PluginContext): Promise<void> {
    return this._workerPool.execPlugin(this.id, "processFile", file, context);
  }
}
