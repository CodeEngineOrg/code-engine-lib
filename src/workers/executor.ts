import { ono } from "ono";
import * as resolveFrom from "resolve-from";
import * as resolveGlobal from "resolve-global";
import { MessagePort, parentPort } from "worker_threads";
import { ParallelPluginModule } from "../plugins";
import { ExecutorConfig, ExecutorRequest, ExecutorResponse, ParallelPluginSignature, WorkerEvent } from "./types";

/**
 * Executes commands in a worker thread that are sent by a corresponding `CodeEngineWorker` running on the main thread.
 */
export class Executor {
  public readonly id: number;
  private readonly _cwd: string;
  private readonly _port: MessagePort;

  public constructor({ id, cwd }: ExecutorConfig) {
    this.id = id;
    this._cwd = cwd;
    this._port = parentPort!;
    this._port.on("message", this._handleMessage.bind(this));
  }

  /**
   * Loads the specified `ParallelPlugin` and returns its signature.
   */
  public async loadParallelPlugin(module: ParallelPluginModule): Promise<ParallelPluginSignature> {
    let exports = await importLocalOrGlobal(module.moduleId, this._cwd);
    console.log("exported type =", typeof exports);

    return {
      name: "foooo",
      processFile: false,
    };
  }

  /**
   * Handles and responds to messages from the `CodeEngineWorker`.
   */
  private async _handleMessage(message: ExecutorRequest) {
    let response: ExecutorResponse = { id: message.id };

    try {
      switch (message.event) {
        case WorkerEvent.LoadPlugin:
          response.value = await this.loadParallelPlugin(message.data as ParallelPluginModule);
          break;

        default:
          throw ono(`Unknown worker event: ${message.event}`);
      }

      this._port.postMessage(response);
    }
    catch (error) {
      response.error = ono(error as Error).toJSON();
      this._port.postMessage(response);
    }
  }
}

/**
 * Imports the specified module, either from the current path, the local "node_modules" folder,
 * or a globally-installed NPM package.
 *
 * @param moduleId - The name or path of the module to import
 * @param [cwd] - The local directory to start searching for the module
 *
 * @returns - The module's export(s)
 */
export async function importLocalOrGlobal<T>(moduleId: string, cwd?: string): Promise<T> {
  let modulePath = resolveFrom.silent(cwd || __dirname, moduleId) || resolveGlobal.silent(moduleId);

  if (!modulePath) {
    throw ono(`Cannot find module "${moduleId}" in the local path or as a globally-installed package.`);
  }

  return import(moduleId);
}
