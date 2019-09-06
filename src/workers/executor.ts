import { ono } from "ono";
import { MessagePort, parentPort } from "worker_threads";
import { WorkerConfig } from "./config";
import { WorkerRequest, WorkerResponse } from "./types";

/**
 * TODO
 */
export class Executor {
  public readonly id: number;
  private readonly _port: MessagePort;

  public constructor(config: WorkerConfig) {
    this.id = config.id;
    this._port = parentPort!;
    this._port.on("message", this._message.bind(this));
  }

  private _message(message: WorkerRequest) {
    let response: WorkerResponse = { id: message.id };

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
