import { ErrorPOJO } from "ono";
import * as path from "path";
import { Worker as WorkerBase } from "worker_threads";
import { awaitOnline } from "./await-online";
import { WorkerConfig } from "./config";
import { PostMessage, WorkerEvent, WorkerRequest, WorkerResponse } from "./types";

const workerScript = path.join(__dirname, "main.js");
let workerID = 0;
let messageID = 0;

interface PendingMessage {
  event: WorkerEvent;
  resolve(value: unknown): void;
  reject(reason: ErrorPOJO): void;
}

/**
 * Controls an `Executor` running on a worker thread.
 */
export class Worker extends WorkerBase {
  public id: number;
  private _isTerminated: boolean;
  private _waitUntilOnline: Promise<void>;
  private readonly _pending: Map<number, PendingMessage>;

  public constructor() {
    let workerData: WorkerConfig = {
      id: ++workerID,
    };

    super(workerScript, { workerData });

    this.id = workerData.id;
    this._isTerminated = false;
    this._waitUntilOnline = awaitOnline(this);
    this._pending = new Map();

    this.on("online", this._online);
    this.on("message", this._message);
    this.on("exit", this._exit);
    this.on("error", this._error);
  }

  public async terminate(): Promise<number> {
    this._isTerminated = true;
    this._rejectAllPending(new Error(`CodeEngine is terminating.`));
    return super.terminate();
  }

  private _online() {
    // console.debug(`CodeEngine worker #${this.id} is online`);
  }

  private _message(message: WorkerResponse) {
    // Find the pending message that this is a response to
    let pending = this._pending.get(message.id);
    if (!pending) {
      throw new Error(`Unknown message ID: ${message.id}`);
    }

    this._pending.delete(message.id);
    if (message.error) {
      pending.reject(message.error);
    }
    else {
      pending.resolve(message.value);
    }
  }

  private _exit(exitCode: number) {
    if (!this._isTerminated) {
      this._error(new Error(`CodeEngine worker #${this.id} unexpectedly exited with code ${exitCode}`));
    }
  }

  private _error(error: Error) {
    this._rejectAllPending(error);
    throw error;
  }

  private async _postMessageAsync<T>(message: PostMessage): Promise<T> {
    await this._waitUntilOnline;

    return new Promise<T>((resolve, reject) => {
      let workerMessage = message as WorkerRequest;
      workerMessage.id = ++messageID;
      this.postMessage(workerMessage);
      this._pending.set(workerMessage.id, { event: message.event, resolve, reject });
    });
  }

  private _rejectAllPending(error: Error): void {
    let currentlyPending = [...this._pending.values()];
    this._pending.clear();

    for (let pending of currentlyPending) {
      pending.reject(error);
    }
  }
}
