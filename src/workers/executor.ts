import { ono } from "ono";
import * as resolveFrom from "resolve-from";
import * as resolveGlobal from "resolve-global";
import { MessagePort, threadId } from "worker_threads";
import { FileListClone } from "../files/file-list-clone";
import { PluginContextClone } from "../plugins/context-clone";
import { FileProcessor, FileProcessorFactory } from "../plugins/types";
import { Messenger, RequestHandlerCallbacks } from "./messenger";
import { FileProcessorData, FileProcessorResults, LoadModuleData, WorkerEvent } from "./types";

/**
 * Executes commands in a worker thread that are sent by a corresponding `CodeEngineWorker` running on the main thread.
 */
export class Executor {
  public readonly id: number;
  private readonly _messenger: Messenger;
  private readonly _processors = new Map<number, FileProcessor>();

  public constructor(id: number, port: MessagePort) {
    this.id = id;
    this._messenger = new Messenger(port, {
      [WorkerEvent.LoadPlugin]: this.loadModule.bind(this),
      [WorkerEvent.ProcessFiles]: this.processFiles.bind(this),
    });
  }

  /**
   * Loads the specified JavaScript module.
   */
  public async loadModule({ id, moduleId, data, cwd }: LoadModuleData): Promise<void> {
    // Import the plugin module
    let exports = await importLocalOrGlobal(moduleId, cwd);

    // Make sure the default export is a function
    let fn = (exports || (exports as { default: unknown }).default);
    if (typeof fn !== "function") {
      throw ono.type({ workerId: this.id, moduleId },
        `Error loading module "${moduleId}". CodeEngine plugin modules must export a function.`);
    }

    let fileProcessor: FileProcessor;

    if (data === undefined) {
      // The module exports a FileProcessor directly
      fileProcessor = fn as FileProcessor;
    }
    else {
      // The module exports a factory function. Call it with the given data.
      fileProcessor = await (fn as FileProcessorFactory)(data);
    }

    if (typeof fileProcessor !== "function") {
      throw ono.type({ workerId: this.id, moduleId },
        `Error loading module "${moduleId}". ${fileProcessor} is not a valid CodeEngine file processor.`);
    }

    this._processors.set(id, fileProcessor);
  }

  /**
   * Processes a file using the specified plugin.
   */
  public async processFiles(data: FileProcessorData, callbacks: RequestHandlerCallbacks)
  : Promise<FileProcessorResults> {
    // Create clones of the File and PluginContext
    let files = new FileListClone(data.files);
    let context = new PluginContextClone(data.context, callbacks);

    // Process the file using the specified plugin
    let fileProcessor = this._processors.get(data.id)!;
    await fileProcessor(files, context);

    // Return any changes to the file
    return { files: FileListClone.serialize(files) };
  }
}


/**
 * Imports the specified module, either from the current path, the local "node_modules" folder,
 * or a globally-installed NPM package.
 *
 * @param moduleId - The name or path of the module to import
 * @param [cwd] - The local directory to start searching for the module
 *
 * @returns - The module's export(s)
 */
async function importLocalOrGlobal<T>(moduleId: string, cwd?: string): Promise<T> {
  let modulePath = resolveFrom.silent(cwd || __dirname, moduleId) || resolveGlobal.silent(moduleId);

  if (!modulePath) {
    throw ono({ workerId: threadId, moduleId },
      `Cannot find module "${moduleId}" in the local path or as a globally-installed package.`);
  }

  return import(moduleId);
}
