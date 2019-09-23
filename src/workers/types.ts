import { SerializedFileList } from "../files/file-list-clone";
import { SerializedContext } from "../plugins/context-clone";
import { ModuleDefinition } from "../plugins/types";

/**
 * Events that occur on a `CodeEngineWorker` or `Executor`.
 */
export enum WorkerEvent {
  Online = "online",
  Terminated = "terminated",
  LoadPlugin = "loadPlugin",
  ProcessFiles = "processFiles",
  Log = "log",
}


/**
 * the data that is passed to a `CodeEngineWorker` or `Executor` to load a module.
 */
export interface LoadModuleData extends ModuleDefinition {
  /**
   * A unique ID that is assigned to each module so they can be referenced across thread boundaries.
   */
  id: number;

  /**
   * The directory path to use when resolving relative modules.
   */
  cwd: string;
}


/**
 * The data that is passed from the `CodeEngineWorker` to the `Executor` to execute
 * a plugin's `processFile()` method.
 */
export interface FileProcessorData {
  id: number;
  files: SerializedFileList;
  context: SerializedContext;
}


/**
 * The data that is passed from the `Executor` back to the `CodeEngineWorker` after executing
 * a plugin's `processFile()` method.
 */
export interface FileProcessorResults {
  files: SerializedFileList;
}
