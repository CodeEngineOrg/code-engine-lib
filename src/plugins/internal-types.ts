import { CodeEnginePlugin } from "./plugin";
import { Plugin, WorkerPlugin } from "./types";


/**
 * Extracts the method names of the given type.
 */
type MethodNames<T> = {
  // tslint:disable-next-line: ban-types
  [k in keyof T]-?: T[k] extends Function | undefined ? k : never;
}[keyof T];


/**
 * The name of a `Plugin` method.
 */
export type PluginMethod = MethodNames<Plugin>;


/**
 * The name of a `WorkerPlugin` method.
 */
export type WorkerPluginMethod = MethodNames<WorkerPlugin>;


/**
 * An array of plugin method names.
 */
export const pluginMethods: PluginMethod[] = ["find", "read", "watch", "processFile", "processAllFiles", "write", "clean"];


/**
 * Determines whether the given value is a CodeEngine `Plugin` object.
 */
export function isPlugin(value: unknown): value is Plugin {
  let plugin = value as Plugin;
  return plugin &&
    typeof plugin === "object" &&
    isOptionalType(plugin.name, "string") &&
    pluginMethods.every((method) => isOptionalType(plugin[method], "function"));
}

/**
 * Determines whether the given value is the specified type or `null` or `undefined`.
 */
function isOptionalType(value: unknown, type: string): boolean {
  return value === undefined || value === null || typeof value === type;
}


/**
 * A plugin that implements the `find()` method.
 */
export type FileSource = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "find">>;

/**
 * Determines whether the given Plugin implements the `find()` method
 */
export function isFileSource(plugin: CodeEnginePlugin): plugin is FileSource {
  return !!plugin.find;
}


/**
 * A plugin that implements the `processFile()` method.
 */
export type FileProcessor = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "processFile">>;

/**
 * Determines whether the given Plugin implements the `processFile()` method
 */
export function isFileProcessor(plugin: CodeEnginePlugin): plugin is FileProcessor {
  return !!plugin.processFile;
}


/**
 * A plugin that implements the `processAllFiles()` method.
 */
export type FileListProcessor = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "processAllFiles">>;

/**
 * Determines whether the given Plugin implements the `processAllFiles()` method
 */
export function isFileListProcessor(plugin: CodeEnginePlugin): plugin is FileListProcessor {
  return !!plugin.processAllFiles;
}


/**
 * A plugin that implements the `write()` method.
 */
export type FileDestination = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "write">>;

/**
 * Determines whether the given Plugin implements the `write()` method
 */
export function isFileDestination(plugin: CodeEnginePlugin): plugin is FileDestination {
  return !!plugin.write;
}


/**
 * A plugin that implements the `clean()` method.
 */
export type DestinationCleaner = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "clean">>;

/**
 * Determines whether the given Plugin implements the `clean()` method
 */
export function isDestinationCleaner(plugin: CodeEnginePlugin): plugin is DestinationCleaner {
  return !!plugin.clean;
}
