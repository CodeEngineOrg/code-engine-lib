import { SerializedFile } from "../files";
import { SerializedPluginContext, WorkerPlugin, WorkerPluginMethod, WorkerPluginModule } from "../plugins";

/**
 * Events that occur on a `CodeEngineWorker` or `Executor`.
 */
export enum WorkerEvent {
  Online = "online",
  Terminated = "terminated",
  LoadPlugin = "loadPlugin",
  ProcessFile = "processFile",
  Log = "log",
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
 * The data that is passed from the `CodeEngineWorker` to the `Executor` to execute
 * a plugin's `processFile()` method.
 */
export interface ProcessFileData {
  pluginId: number;
  file: SerializedFile;
  context: SerializedPluginContext;
}


/**
 * The data that is passed from the `Executor` back to the `CodeEngineWorker` after executing
 * a plugin's `processFile()` method.
 */
export interface ProcessFileResults {
  file: SerializedFile;
}
