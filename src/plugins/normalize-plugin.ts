import { PluginDefinition } from "@code-engine/types";
import { WorkerPool } from "@code-engine/workers";
import { ono } from "ono";
import { isModuleDefinition, NormalizedPlugin } from "./types";


/**
 * Normalizes any `PluginDefinition` value to a `Plugin` object.
 * @internal
 */
export async function normalizePlugin(definition: PluginDefinition, workerPool: WorkerPool, defaultName: string): Promise<NormalizedPlugin> {
  try {
    if (typeof definition === "function") {
      // This plugin is just a main-thread processFile() method
      definition = { name: definition.name, processFile: definition };
    }
    else if (isModuleDefinition(definition)) {
      // This plugin is just a worker-thread processFile() method
      definition = { processFile: definition };
    }
    else if (!definition || typeof definition !== "object") {
      throw ono.type(
        "CodeEngine plugins must be an object, function, or string, not " +
        Object.prototype.toString.call(definition) + ".");
    }

    if (isModuleDefinition(definition.processFile)) {
      // Load the processFile method on all worker threads
      definition.processFile = await workerPool.loadFileProcessor(definition.processFile);
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
