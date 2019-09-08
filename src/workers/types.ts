import { ErrorPOJO } from "ono";
import { WorkerPlugin, WorkerPluginMethod, WorkerPluginModule } from "../plugins";

/**
 * Events that occur on a `CodeEngineWorker` or `Executor`.
 */
export enum WorkerEvent {
  Online = "online",
  Terminated = "terminated",
  LoadPlugin = "loadPlugin",
  ExecPlugin = "execPlugin",
}


/**
 * A message sent from a `CodeEngineWorker` to an `Executor`
 */
export interface PostMessage {
  event: WorkerEvent;
  data?: unknown;
}


/**
 * A message that has been sent from a `CodeEngineWorker` to an `Executor`, but has't been responded to yet.
 */
export interface PendingMessage {
  /**
   * The event that the message is for.
   */
  event: WorkerEvent;

  /**
   * Resolves the pending Promise when a response is received from the `Executor`.
   */
  resolve(value: unknown): void;

  /**
   * Rejects the pending Promise when an error occurs or the thread is terminated.
   */
  reject(reason: ErrorPOJO): void;
}


/**
 * A request received by an `Executor` from a `CodeEngineWorker`.
 */
export interface ExecutorRequest extends PostMessage {
  id: number;
}


/**
 * A response sent by an `Executor` to a `CodeEngineWorker`.
 */
export interface ExecutorResponse {
  id: number;
  error?: ErrorPOJO;
  value?: unknown;
}


/**
 * Instructs a `CodeEngineWorker` or `Executor` to load the specified `WorkerPluginModule`.
 */
export interface LoadWorkerPluginInfo extends WorkerPluginModule {
  /**
   * A unique ID that is assigned to each plugin so they can be referenced across thread boundaries.
   */
  pluginId: number;
}


/**
 * An object that indicates which methods are implemented by a `WorkerPlugin`.
 */
export type WorkerPluginSignature = {
  [k in keyof WorkerPlugin]-?: k extends WorkerPluginMethod ? boolean : WorkerPlugin[k];
};


/**
 * The data that is passed from the `CodeEngineWorker` to the `Executor` for the `ExecPlugin` event.
 */
export interface ExecPluginData {
  /**
   * The unique ID of the plugin to execute
   */
  pluginId: number;

  /**
   * The plugin method to execute
   */
  method: WorkerPluginMethod;

  /**
   * The arguments to pass to the method
   */
  args: unknown[];
}
