import { ono } from "ono";
import { WorkerPool } from "../workers/worker-pool";
import { FileProcessor, Plugin, PluginDefinition } from "./types";

/**
 * A normalized plugin definition
 */
export type NormalizedPlugin = { name: string; processFile?: FileProcessor } & Omit<Plugin, "name" | "processFile">;

/**
 * Loads the given `Plugin` or `ModuleDefinition`.
 */
export async function normalizePlugin(definition: PluginDefinition, workerPool: WorkerPool, defaultName: string): Promise <NormalizedPlugin> {
  try {
    if (typeof definition === "function") {
      // This plugin simply consists of a main-thread processFile() method
      definition = { name: definition.name, processFile: definition };
    }
    else if (typeof definition === "string" || (definition && "moduleId" in definition)) {
      // This plugin simply consists of a worker-thread processFile() method
      definition = { processFile: definition };
    }
    else if (!definition || typeof definition !== "object") {
      throw ono.type(`CodeEngine plugins must be an object, function, or string, not ${definition}.`);
    }

    if (typeof definition.processFile === "string"
    || (definition.processFile && "moduleId" in definition.processFile)) {
      // The processFile method is implemented as a separate module, so load the module on all worker threads.
      definition.processFile = await workerPool.loadModule(definition.processFile);
    }

    return {
      ...definition,
      name: String(definition.name || defaultName),
      processFile: definition.processFile,
    };
  }
  catch (error) {
    throw ono(error, `Error in ${defaultName}.`);
  }
}
