import { ParallelPluginSignature, WorkerPool } from "../workers";
import { ParallelPlugin } from "./types";

/**
 * The internal CodeEngine implementation of the `ParallelPlugin` interface.
 * This class runs a plugin in parallel across many worker threads.
 */
export class CodeEngineParallelPlugin implements ParallelPlugin {
  public readonly name: string;
  private _workerPool: WorkerPool;

  public constructor(signature: ParallelPluginSignature, workerPool: WorkerPool) {
    this._workerPool = workerPool;
    this.name = signature.name;
  }

  /**
   * Returns a string representation of the plugin.
   */
  public toString(): string {
    return "ParallelPlugin";
  }

  /**
   * Returns the name to use for `Object.toString()`.
   */
  public get [Symbol.toStringTag](): string {
    return "ParallelPlugin";
  }
}
