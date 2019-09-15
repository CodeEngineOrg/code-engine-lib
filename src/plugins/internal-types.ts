import { CodeEnginePlugin } from "./plugin";
import { ModuleDefinition, Plugin } from "./types";


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
export type PluginMethodName = MethodNames<Plugin>;


/**
 * An array of plugin method names.
 */
export const pluginMethods: PluginMethodName[] = ["find", "read", "watch", "processAll", "write", "clean"];


/**
 * Determines whether the given value is a CodeEngine `Plugin` object.
 */
export function isPlugin(value: unknown): value is Plugin {
  let plugin = value as Plugin;
  return plugin &&
    typeof plugin === "object" &&
    isOptionalType(plugin.name, "string") &&
    pluginMethods.every((method) => isOptionalType(plugin[method], "function")) &&
    (
      isOptionalType(plugin.processEach, "string") ||
      isOptionalType(plugin.processEach, "function") ||
      typeof (plugin.processEach as ModuleDefinition).moduleId === "string"
    );
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
 * A plugin that implements the `processEach()` method.
 */
export type HasProcessEach = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "processEach">>;

/**
 * Determines whether the given Plugin implements the `processEach()` method
 */
export function hasProcessEach(plugin: CodeEnginePlugin): plugin is HasProcessEach {
  return !!plugin.processEach;
}


/**
 * A plugin that implements the `processAll()` method.
 */
export type HasProcessAll = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "processAll">>;

/**
 * Determines whether the given Plugin implements the `processAll()` method
 */
export function hasProcessAll(plugin: CodeEnginePlugin): plugin is HasProcessAll {
  return !!plugin.processAll;
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
