import { ono } from "ono";
import * as resolveFrom from "resolve-from";
import * as resolveGlobal from "resolve-global";
import { MessagePort, threadId } from "worker_threads";
import { FileClone } from "../files";
import { isPlugin, PluginContextClone, WorkerPlugin, WorkerPluginFactory } from "../plugins";
import { Messenger, RequestHandlerCallbacks } from "./messenger";
import { LoadWorkerPluginInfo, ProcessFileData, ProcessFileResults, WorkerEvent, WorkerPluginSignature } from "./types";

/**
 * Executes commands in a worker thread that are sent by a corresponding `CodeEngineWorker` running on the main thread.
 */
export class Executor {
  public readonly id: number;
  private readonly _messenger: Messenger;
  private readonly _plugins = new Map<number, WorkerPlugin>();

  public constructor(id: number, port: MessagePort) {
    this.id = id;
    this._messenger = new Messenger(port, {
      [WorkerEvent.LoadPlugin]: this.loadWorkerPlugin.bind(this),
      [WorkerEvent.ProcessFile]: this.processFile.bind(this),
    });
  }

  /**
   * Loads the specified `WorkerPlugin` and returns its signature.
   */
  public async loadWorkerPlugin(info: LoadWorkerPluginInfo): Promise<WorkerPluginSignature> {
    let { pluginId, moduleId, data, cwd } = info;

    // Import the plugin module
    let exports = await importLocalOrGlobal(moduleId, cwd);

    // Make sure the default export is a function
    let factory = (exports || (exports as { default: unknown }).default) as WorkerPluginFactory;
    if (typeof factory !== "function") {
      throw ono.type({ workerId: this.id, moduleId },
        `Error loading module "${moduleId}". CodeEngine plugin modules must export a function.`);
    }

    // Call the exported function to get the plugin
    let plugin = await factory(data);
    if (!isPlugin(plugin)) {
      throw ono.type({ workerId: this.id, moduleId },
        `Error loading module "${moduleId}". ${plugin} is not a valid CodeEngine plugin.`);
    }

    this._plugins.set(pluginId, plugin);

    return {
      name: plugin.name,
      processFile: typeof plugin.processFile === "function",
    };
  }

  /**
   * Processes a file using the specified plugin.
   */
  public async processFile(data: ProcessFileData, callbacks: RequestHandlerCallbacks): Promise<ProcessFileResults> {
    // Create clones of the File and PluginContext
    let file = new FileClone(data.file, callbacks);
    let context = new PluginContextClone(data.context, callbacks);

    // Process the file using the specified plugin
    let plugin = this._plugins.get(data.pluginId)!;

    try {
      await plugin.processFile!(file, context);
    }
    catch (error) {
      throw ono(error, { path: file.path }, `${plugin.name} threw an error while processing ${file}`);
    }

    // Return any changes to the file
    return { file: FileClone.serialize(file) };
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
