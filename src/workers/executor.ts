import { ono } from "ono";
import { MessagePort, parentPort } from "worker_threads";
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

  private _message(message: ExecutorRequest) {
    let response: ExecutorResponse = { id: message.id };

    try {
      switch (message.event) {
        default:
          throw new Error(`Unknown worker event: ${message.event}`);
      }

      this._port.postMessage(response);
    }
    catch (error) {
      response.error = ono(error as Error).toJSON();
      this._port.postMessage(response);
    }
  }
}
