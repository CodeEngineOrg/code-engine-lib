import { stringify } from "@code-engine/stringify";
import { CodeEngine, FileProcessor, ModuleDefinition, MountedPlugin, Plugin, PluginDefinition } from "@code-engine/types";
import { WorkerPool } from "@code-engine/workers";
import { ono } from "@jsdevtools/ono";
import { isModuleDefinition, isPlugin } from "./types";


/**
 * Mounts any `PluginDefinition` value, returning a sanitized and normalized plugin.
 * @internal
 */
export async function mountPlugin(engine: CodeEngine, workerPool: WorkerPool, definition: PluginDefinition, defaultName: string): Promise<MountedPlugin> {
  let name: string | undefined;
  let processFile: FileProcessor | undefined;

  try {
    let normalized = normalizePluginDefinition(definition);
    name = normalized.name;

    if (isModuleDefinition(normalized.processFile)) {
      // Import the FileProcessor on all worker threads
      let { moduleId, data } = normalized.processFile;
      processFile = await workerPool.importFileProcessor(moduleId, data);

      // Use the FileProcessor's name as the plugin name, if necessary
      name = name || processFile.name;
    }
    else {
      processFile = normalized.processFile;
    }

    // Fallback to a default name if no name was specified
    name = String(name || defaultName);

    // Replace/set the properties of the original plugin object
    return Object.assign(normalized, { engine, name, processFile });
  }
  catch (error) {
    throw ono(error, `Error in ${name || defaultName}.`);
  }
}

/**
 * A CodeEngine Plugin that has been normalized so that it always has a `name`,
 * and its `processFile`, if set, is always a `FileProcessor` function.
 * @internal
 */
type NormalizedPlugin = Omit<Plugin, "processFile"> & {
  processFile?: FileProcessor | ModuleDefinition<FileProcessor>;
};

/**
 * Normalizes a `PluginDefinition` value to a `Plugin` object.
 * @internal
 */
export function normalizePluginDefinition(definition: PluginDefinition): NormalizedPlugin {
  let normalized: NormalizedPlugin;

  if (typeof definition === "function") {
    // This plugin is just a main-thread processFile() method
    normalized = { name: definition.name, processFile: definition };
  }
  else if (typeof definition === "string") {
    // This plugin is just a worker-thread processFile() method
    normalized = { processFile: { moduleId: definition }};
  }
  else if (isModuleDefinition(definition)) {
    // This plugin is just a worker-thread processFile() method
    normalized = { processFile: definition };
  }
  else if (isPlugin(definition)) {
    normalized = definition as NormalizedPlugin;

    if (typeof definition.processFile === "string") {
      normalized.processFile = { moduleId: definition.processFile };
    }
  }
  else {
    throw ono.type(`Invalid CodeEngine plugin: ${stringify(definition)}`);
  }

  return normalized;
}
