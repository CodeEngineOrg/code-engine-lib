import { stringify } from "@code-engine/stringify";
import { FileProcessor, Plugin, PluginDefinition } from "@code-engine/types";
import { WorkerPool } from "@code-engine/workers";
import { ono } from "ono";
import { isModuleDefinition, isPlugin } from "./types";

/**
 * A CodeEngine Plugin that has been normalized so that it always has a `name`,
 * and its `processFile`, if set, is always a `FileProcessor` function.
 * @internal
 */
export type NormalizedPlugin = Omit<Plugin, "name" | "processFile"> & {
  name: string;
  processFile?: FileProcessor;
};


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
      throw ono.type(`Invalid CodeEngine plugin: ${stringify(definition)}`);
    }

    let name = definition.name;

    if (isModuleDefinition(definition.processFile)) {
      // Import the FileProcessor on all worker threads
      definition.processFile = await workerPool.importFileProcessor(definition.processFile);
      name = name || definition.processFile.name;
    }

    definition.name = String(name || defaultName);
    return definition as NormalizedPlugin;
  }
  catch (error) {
    throw ono(error, `Error in ${defaultName}.`);
  }
}
