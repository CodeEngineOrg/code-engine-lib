import { ono } from "ono";
import * as resolveFrom from "resolve-from";
import * as resolveGlobal from "resolve-global";
import { MessagePort, parentPort } from "worker_threads";
import { isPlugin, WorkerPlugin, WorkerPluginFactory, WorkerPluginMethod } from "../plugins";
import { ExecPluginData, ExecutorConfig, ExecutorRequest, ExecutorResponse, LoadWorkerPluginInfo, WorkerEvent, WorkerPluginSignature } from "./types";

/**
 * Executes commands in a worker thread that are sent by a corresponding `CodeEngineWorker` running on the main thread.
 */
export class Executor {
  public readonly id: number;
  private readonly _cwd: string;
  private readonly _port: MessagePort;
  private readonly _plugins = new Map<number, WorkerPlugin>();

  public constructor({ id, cwd }: ExecutorConfig) {
    this.id = id;
    this._cwd = cwd;
    this._port = parentPort!;
    this._port.on("message", this._handleMessage.bind(this));
  }

  /**
   * Loads the specified `WorkerPlugin` and returns its signature.
   */
  public async loadWorkerPlugin(info: LoadWorkerPluginInfo): Promise<WorkerPluginSignature> {
    let { pluginId, moduleId, data } = info;

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
  private async _handleMessage(message: ExecutorRequest) {
    let response: ExecutorResponse = { id: message.id };

    try {
      switch (message.event) {
        case WorkerEvent.LoadPlugin:
          response.value = await this.loadWorkerPlugin(message.data as LoadWorkerPluginInfo);
          break;

        case WorkerEvent.ExecPlugin:
          let { pluginId, method, args } = message.data as ExecPluginData;
          response.value = await this.execPlugin(pluginId, method, args);
          break;

        default:
          throw ono(`Unknown worker event: ${message.event}`);
      }

      this._port.postMessage(response);
    }
    catch (error) {
      response.error = ono(error as Error).toJSON();
      this._port.postMessage(response);
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
