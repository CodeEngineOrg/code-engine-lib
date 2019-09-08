import { File } from "../files";
import { WorkerPluginSignature, WorkerPool } from "../workers";
import { PluginContext, WorkerPlugin } from "./types";

/**
 * The internal CodeEngine implementation of the `WorkerPlugin` interface.
 * This class runs a plugin in parallel across many worker threads.
 */
export class CodeEngineWorkerPlugin implements WorkerPlugin {
  public readonly id: number;
  public readonly name: string;
  private _workerPool: WorkerPool;

  public constructor(id: number, signature: WorkerPluginSignature, workerPool: WorkerPool) {
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
