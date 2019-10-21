import { PluginDefinition } from "@code-engine/types";
import { valueToString } from "@code-engine/utils";
import { WorkerPool } from "@code-engine/workers";
import { ono } from "ono";
import { isModuleDefinition, isPlugin, NormalizedPlugin } from "./types";


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
    else if (!isPlugin(definition)) {
      throw ono.type(`Invalid CodeEngine plugin: ${valueToString(definition)}`);
    }

    if (isModuleDefinition(definition.processFile)) {
      // Load the processFile method on all worker threads
      definition.processFile = await workerPool.loadFileProcessor(definition.processFile);
    }

    definition.name = String(definition.name || defaultName);
    return definition as NormalizedPlugin;
  }
  catch (error) {
    throw ono(error, `Error in ${defaultName}.`);
  }
}
