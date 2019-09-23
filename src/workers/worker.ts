import { ono } from "ono";
import * as path from "path";
import { Worker } from "worker_threads";
import { CodeEngine } from "../code-engine";
import { FileListClone } from "../files/file-list-clone";
import { FileList } from "../files/types";
import { LogEventData, LoggerMethods, LogLevel } from "../loggers/types";
import { ContextClone } from "../plugins/context-clone";
import { Context } from "../plugins/types";
import { awaitOnline } from "./await-online";
import { Messenger } from "./messenger";
import { FileProcessorData, FileProcessorResults, LoadModuleData, WorkerEvent } from "./types";

const workerScript = path.join(__dirname, "main.js");

/**
 * Controls an `Executor` instance running on a worker thread.
 */
export class CodeEngineWorker extends Worker {
  private _engine: CodeEngine;
  private _isTerminated: boolean;
  private _waitUntilOnline: Promise<void>;
  private readonly _messenger: Messenger;

  public constructor(engine: CodeEngine) {
    super(workerScript);

    this._engine = engine;
    this._isTerminated = false;
    this._waitUntilOnline = awaitOnline(this);
    this._messenger = new Messenger(this);

    this.on("online", this._handleOnline);
    this.on("exit", this._handleExit);
    this.on("error", this._handleError);
  }

  /**
   * Loads the specified JavaScript module in the worker thread.
   */
  public async loadModule(data: LoadModuleData): Promise<void> {
    await this._waitUntilOnline;
    return this._messenger.sendRequest({ event: WorkerEvent.LoadPlugin, data });
  }

  /**
   * Processes the given files in the worker thread.
   */
  public async processFiles(id: number, files: FileList, context: Context): Promise<void> {
    await this._waitUntilOnline;
    this._debug(WorkerEvent.ProcessFiles, `CodeEngine worker #${this.threadId} is processing ${[files]}`);

    let data: FileProcessorData = {
      id,
      files: FileListClone.serialize(files),
      context: ContextClone.serialize(context),
    };

    function log({ level, message, ...other }: LogEventData) {
      let logger = context.logger as unknown as LoggerMethods;
      let method = level === LogLevel.Info ? "log" : level === LogLevel.Warning ? "warn" : level;
      logger[method](message, other);
    }

    let results: FileProcessorResults;
    results = await this._messenger.sendRequest({ event: WorkerEvent.ProcessFiles, data, log });
    FileListClone.update(files, results.files);
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
    this._engine._error(error);
  }

  /**
   * Logs a debug message for this worker.
   */
  private _debug(event: WorkerEvent, message: string, data?: object) {
    this._engine.logger.debug(message, { ...data, event, workerId: this.threadId });
  }
}
