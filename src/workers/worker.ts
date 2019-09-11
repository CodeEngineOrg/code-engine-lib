import { ono } from "ono";
import * as path from "path";
import { Worker } from "worker_threads";
import { CodeEngine } from "../code-engine";
import { File, FileClone } from "../files";
import { LogEventData, LoggerMethods, LogLevel } from "../loggers";
import { CodeEngineWorkerPlugin, PluginContext, PluginContextClone } from "../plugins";
import { awaitOnline } from "./await-online";
import { ExecutorConfig, WorkerConfig } from "./config";
import { Messenger } from "./messenger";
import { LoadWorkerPluginInfo, ProcessFileData, ProcessFileResults, WorkerEvent, WorkerPluginSignature } from "./types";

const workerScript = path.join(__dirname, "main.js");

/**
 * Controls an `Executor` instance running on a worker thread.
 */
export class CodeEngineWorker extends Worker {
  private _engine: CodeEngine;
  private _isTerminated: boolean;
  private _waitUntilOnline: Promise<void>;
  private readonly _messenger: Messenger;

  public constructor({ cwd, engine }: WorkerConfig) {
    let workerData: ExecutorConfig = { cwd };
    super(workerScript, { workerData });

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
    await this._waitUntilOnline;
    return this._messenger.sendRequest({ event: WorkerEvent.LoadPlugin, data: module });
  }

  /**
   * Processes the given file in the worker thread.
   */
  public async processFile(plugin: CodeEngineWorkerPlugin, file: File, context: PluginContext): Promise<void> {
    await this._waitUntilOnline;
    this._debug(WorkerEvent.ProcessFile, `CodeEngine worker #${this.threadId} is processing ${file}`, { file });

    let data: ProcessFileData = {
      pluginId: plugin.id,
      file: FileClone.serialize(file),
      context: PluginContextClone.serialize(context),
    };

    function log({ level, message, ...other }: LogEventData) {
      let logger = context.logger as unknown as LoggerMethods;
      let method = level === LogLevel.Info ? "log" : LogLevel.Warning ? "warn" : level;
      logger[method](message, other);
    }

    let results: ProcessFileResults = await this._messenger.sendRequest({ event: WorkerEvent.ProcessFile, data, log });
    FileClone.update(file, results.file);
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
    this._debug(WorkerEvent.Terminated, `CodeEngine worker #${this.threadId} has terminated`, { exitCode });
    return exitCode;
  }

  /**
   * Logs a debug message when the worker thread comes online.
   */
  private _handleOnline() {
    this._debug(WorkerEvent.Online, `CodeEngine worker #${this.threadId} is online`);
  }

  /**
   * Handles the worker thread exiting, either because we told it to terminate, or because it crashed.
   */
  private async _handleExit(exitCode: number) {
    if (!this._isTerminated) {
      // The worker crashed or exited unexpectedly
      await this._handleError(ono(`CodeEngine worker #${this.threadId} unexpectedly exited with code ${exitCode}`));
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
    this._engine.logger.debug(message, { ...data, event, workerId: this.threadId });
  }
}
