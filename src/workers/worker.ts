import { ono } from "ono";
import * as path from "path";
import { Worker } from "worker_threads";
import { CodeEngine } from "../code-engine";
import { File } from "../files";
import { CodeEngineWorkerPlugin, PluginContext } from "../plugins";
import { awaitOnline } from "./await-online";
import { ExecutorConfig, WorkerConfig } from "./config";
import { Messenger } from "./messenger";
import { LoadWorkerPluginInfo, ProcessFileData, WorkerEvent, WorkerPluginSignature } from "./types";

const workerScript = path.join(__dirname, "main.js");
let workerCounter = 0;

/**
 * Controls an `Executor` instance running on a worker thread.
 */
export class CodeEngineWorker extends Worker {
  public id: number;
  private _engine: CodeEngine;
  private _isTerminated: boolean;
  private _waitUntilOnline: Promise<void>;
  private readonly _messenger: Messenger;

  public constructor({ cwd, engine }: WorkerConfig) {
    let id = ++workerCounter;
    let workerData: ExecutorConfig = { id, cwd };

    super(workerScript, { workerData });

    this.id = id;
    this._engine = engine;
    this._isTerminated = false;
    this._waitUntilOnline = awaitOnline(this);
    this._messenger = new Messenger(this);

    this.on("online", this._handleOnline);
    this.on("exit", this._handleExit);
    this.on("error", this._handleError);
  }

  /**
   * Loads the specified `WorkerPlugin` in the worker thread.
   */
  public async loadWorkerPlugin(module: LoadWorkerPluginInfo): Promise<WorkerPluginSignature> {
    return this._sendRequest({ event: WorkerEvent.LoadPlugin, data: module });
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
    this._messenger.rejectAllPending(ono(`CodeEngine is terminating.`));
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
   * Handles the worker thread exiting, either because we told it to terminate, or because it crashed.
   */
  private async _handleExit(exitCode: number) {
    if (!this._isTerminated) {
      // The worker crashed or exited unexpectedly
      await this._handleError(ono(`CodeEngine worker #${this.id} unexpectedly exited with code ${exitCode}`));
    }
  }

  /**
   * Handles an unexpected error on the worker thread.
   */
  private async _handleError(error: Error) {
    // Crash the worker thread and clean-up state
    await this.terminate();

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
   * Sends a request to the `Executor` and awaits a response.
   */
  private async _sendRequest<T>(req: Omit<OriginalRequest, "type" | "id">): Promise<T> {
    await this._waitUntilOnline;
    return this._messenger.sendRequest(req);
  }
}
