import { ono } from "ono";
import * as path from "path";
import { Worker as WorkerBase } from "worker_threads";
import { CodeEngine } from "../code-engine";
import { WorkerPluginMethod } from "../plugins";
import { awaitOnline } from "./await-online";
import { ExecPluginData, ExecutorConfig, ExecutorRequest, ExecutorResponse, LoadWorkerPluginInfo, PendingMessage, PostMessage, WorkerConfig, WorkerEvent, WorkerPluginSignature } from "./types";

const workerScript = path.join(__dirname, "main.js");
let workerCounter = 0;
let messageCounter = 0;

/**
 * Controls an `Executor` instance running on a worker thread.
 */
export class CodeEngineWorker extends WorkerBase {
  public id: number;
  private _engine: CodeEngine;
  private _isTerminated: boolean;
  private _waitUntilOnline: Promise<void>;
  private readonly _pending: Map<number, PendingMessage>;

  public constructor({ cwd, engine }: WorkerConfig) {
    let workerData: ExecutorConfig = {
      id: ++workerCounter,
      cwd,
    };

    super(workerScript, { workerData });

    this.id = workerData.id;
    this._engine = engine;
    this._isTerminated = false;
    this._waitUntilOnline = awaitOnline(this);
    this._pending = new Map();

    this.on("online", this._handleOnline);
    this.on("message", this._handleMessage);
    this.on("exit", this._handleExit);
    this.on("error", this._handleError);
  }

  /**
   * Loads the specified `WorkerPlugin` in the worker thread.
   */
  public async loadWorkerPlugin(module: LoadWorkerPluginInfo): Promise<WorkerPluginSignature> {
    return this.postMessage({ event: WorkerEvent.LoadPlugin, data: module });
  }

  /**
   * Executes the specified plugin method on the worker thread via the `Executor`.
   */
  public async execPlugin<T>(pluginId: number, method: WorkerPluginMethod,  args: unknown[]): Promise<T> {
    let data: ExecPluginData = { pluginId, method, args };
    return this.postMessage({ event: WorkerEvent.ExecPlugin, data });
  }

  /**
   * Terminates the worker thread and cancels all pending operations.
   */
  public async terminate(): Promise<number> {
    if (this._isTerminated) {
      return 0;
    }

    this._isTerminated = true;
    this._rejectAllPending(ono(`CodeEngine is terminating.`));
    let exitCode = await super.terminate();
    this._debug(WorkerEvent.Terminated, `CodeEngine worker #${this.id} has terminated`, { exitCode });
    return exitCode;
  }

  /**
   * Logs a debug message when the worker thread comes online.
   */
  private _handleOnline() {
    this._debug(WorkerEvent.Online, `CodeEngine worker #${this.id} is online`);
  }

  /**
   * Handles messages from the `Executor`.
   */
  private _handleMessage(message: ExecutorResponse) {
    if (this._isTerminated) {
      // Ignore messages received after termination.
      // We've already rejected the pending Promises.
      return;
    }

    // Find the pending message that this is a response to
    let pending = this._pending.get(message.id);
    if (!pending) {
      throw ono(`Unknown message ID: ${message.id}`);
    }

    this._pending.delete(message.id);
    if (message.error) {
      pending.reject(message.error);
    }
    else {
      pending.resolve(message.value);
    }
  }

  /**
   * Handles the worker thread exiting, either because we told it to terminate, or because it crashed.
   */
  private _handleExit(exitCode: number) {
    if (!this._isTerminated) {
      // The worker crashed or exited unexpectedly
      this._handleError(ono(`CodeEngine worker #${this.id} unexpectedly exited with code ${exitCode}`));
    }
  }

  /**
   * Handles the worker thread crashing, usually due to an unhandled error.
   * In this case, Node will automatically terminate the worker thread.
   */
  private _handleError(error: Error) {
    // Update our flag to match the fact that Node has terminated the worker thread
    this._isTerminated = true;

    // Any pending operations on the worker have failed
    this._rejectAllPending(error);

    // Crash CodeEngine as well, since we're now in an unknown state
    this._engine.error(error);
  }

  /**
   * Logs a debug message for this worker.
   */
  private _debug(event: WorkerEvent, message: string, data?: object) {
    this._engine.logger.debug(message, { ...data, event, workerId: this.id });
  }

  /**
   * Sends a message to the `Executor` and awaits a response.
   */
  public async postMessage<T>(message: PostMessage): Promise<T> {
    await this._waitUntilOnline;

    return new Promise<T>((resolve, reject) => {
      let request = message as ExecutorRequest;
      request.id = ++messageCounter;
      super.postMessage(request);
      this._pending.set(request.id, { event: request.event, resolve, reject });
    });
  }

  /**
   * Rejects all pending messages between the `CodeEngineWorker` and the `Executor`.
   */
  private _rejectAllPending(error: Error): void {
    let currentlyPending = [...this._pending.values()];
    this._pending.clear();

    for (let pending of currentlyPending) {
      pending.reject(error);
    }
  }
}
