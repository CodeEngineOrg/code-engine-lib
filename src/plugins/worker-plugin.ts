import { WorkerPluginSignature, WorkerPool } from "../workers";
import { CodeEnginePlugin } from "./plugin";
import { Plugin } from "./types";

/**
 * The internal CodeEngine implementation of the `WorkerPlugin` interface.
 * This class runs a plugin in parallel across many worker threads.
 */
export class CodeEngineWorkerPlugin extends CodeEnginePlugin {
  public readonly id: number;
  private _workerPool: WorkerPool;

  public constructor(id: number, signature: WorkerPluginSignature, workerPool: WorkerPool) {
    let plugin: Plugin = {};

    if (signature.processFile) {
      plugin.processFile = (file, context) => {
        let worker = this._workerPool.select();
        return worker.processFile(this, file, context);
      };
    }

    super(plugin, signature.name);
    this.id = id;
    this._workerPool = workerPool;
  }
}
