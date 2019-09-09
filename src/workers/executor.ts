import { ono } from "ono";
import * as resolveFrom from "resolve-from";
import * as resolveGlobal from "resolve-global";
import { parentPort } from "worker_threads";
import { File } from "../files";
import { isPlugin, PluginContext, WorkerPlugin, WorkerPluginFactory } from "../plugins";
import { ExecutorConfig } from "./config";
import { Messenger } from "./messenger";
import { LoadWorkerPluginInfo, ProcessFileData, WorkerEvent, WorkerPluginSignature } from "./types";

/**
 * Executes commands in a worker thread that are sent by a corresponding `CodeEngineWorker` running on the main thread.
 */
export class Executor {
  public readonly id: number;
  private readonly _cwd: string;
  private readonly _messenger: Messenger;
  private readonly _plugins = new Map<number, WorkerPlugin>();

  public constructor({ id, cwd }: ExecutorConfig) {
    this.id = id;
    this._cwd = cwd;
    this._messenger = new Messenger(parentPort!, {
      [WorkerEvent.LoadPlugin]: this.loadWorkerPlugin.bind(this),
      [WorkerEvent.ProcessFile]: this.processFile.bind(this),
    });
  }

  /**
   * Loads the specified `WorkerPlugin` and returns its signature.
   */
  public async loadWorkerPlugin({ pluginId, moduleId, data }: LoadWorkerPluginInfo): Promise<WorkerPluginSignature> {
    // Import the plugin module
    let exports = await importLocalOrGlobal(moduleId, this._cwd);

    // Make sure the default export is a function
    let factory = (exports || (exports as { default: unknown }).default) as WorkerPluginFactory;
    if (typeof factory !== "function") {
      throw ono.type(`Error loading module "${moduleId}". CodeEngine plugin modules must export a function.`);
    }

    // Call the exported function to get the plugin
    let plugin = await factory(data);
    if (!isPlugin(plugin)) {
      throw ono.type(`Error loading module "${moduleId}". ${plugin} is not a valid CodeEngine plugin.`);
    }

    this._plugins.set(pluginId, plugin);

    return {
      name: plugin.name,
      processFile: typeof plugin.processFile === "function",
    };
  }

  /**
   * Executes the specified plugin method.
   */
  public async execPlugin<T>(pluginId: number, method: WorkerPluginMethod,  args: unknown[]): Promise<T> {
    let plugin = this._plugins.get(pluginId)!;
    let pluginMethod = plugin[method]! as (...args: unknown[]) => void | T | Promise<T>;
    return pluginMethod.call(plugin, ...args) as Promise<T>;
  }

  /**
   * Handles and responds to messages from the `CodeEngineWorker`.
   */
  private async _handleMessage(request: Request) {
    switch (request.event) {
      case WorkerEvent.LoadPlugin:
        return this.loadWorkerPlugin(request.data as LoadWorkerPluginInfo);

      case WorkerEvent.ProcessFile:
        let { pluginId, file, context } = request.data as ProcessFileData;
        return this.processFile(pluginId, file, context);

      default:
        throw ono(`Unknown worker event: ${request.event}`);
    }
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
    throw ono(`Cannot find module "${moduleId}" in the local path or as a globally-installed package.`);
  }

  return import(moduleId);
}
