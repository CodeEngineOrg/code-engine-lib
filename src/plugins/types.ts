import { FileProcessor, ModuleDefinition, Plugin } from "@code-engine/types";
import { CodeEnginePlugin } from "./plugin";


/**
 * A CodeEngine Plugin that has been normalized so that it always has a `name`,
 * and its `processFile`, if set, is always a `FileProcessor` function.
 * @internal
 */
export type NormalizedPlugin = { name: string; processFile?: FileProcessor } & Omit<Plugin, "name" | "processFile">;


/**
 * Determines if the given value is a `ModuleDefinition` object,
 * or a string that's shorthand for `ModuleDefinition.moduleId`.
 * @internal
 */
export function isModuleDefinition(value: unknown): value is string | ModuleDefinition {
  return typeof value === "string" || (value && typeof (value as ModuleDefinition).moduleId === "string");
}


/**
 * Determines if the given value is a `Plugin` object.
 * @internal
 */
export function isPlugin(value: unknown): value is Plugin {
  let plugin = value as Plugin;
  return plugin &&
    typeof plugin === "object" &&
    (
      isModuleDefinition(plugin.processFile) ||
      typeof plugin.processFile === "function" ||
      typeof plugin.processFiles === "function" ||
      typeof plugin.read === "function" ||
      typeof plugin.watch === "function" ||
      typeof plugin.clean === "function" ||
      typeof plugin.dispose === "function"
    );
}


/**
 * A plugin that implements the `read()` method.
 * @internal
 */
export type FileSource = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "read">>;

/**
 * Determines whether the given Plugin implements the `read()` method
 * @internal
 */
export function isFileSource(plugin: CodeEnginePlugin): plugin is FileSource {
  return !!plugin.read;
}


/**
 * A plugin that implements the `processFile()` and/or `processFiles()` methods.
 * @internal
 */
export type BuildStep = CodeEnginePlugin &
  (Required<Pick<CodeEnginePlugin, "processFile">> | Required<Pick<CodeEnginePlugin, "processFiles">>);

/**
 * Determines whether the given Plugin implements the `processFile()` and/or `processFiles()` methods.
 * @internal
 */
export function isBuildStep(plugin: CodeEnginePlugin): plugin is BuildStep {
  return !!plugin.processFile || !!plugin.processFiles;
}


/**
 * A plugin that implements the `watch()` method.
 * @internal
 */
export type HasWatch = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "watch">>;

/**
 * Determines whether the given Plugin implements the `watch()` method
 * @internal
 */
export function hasWatch(plugin: CodeEnginePlugin): plugin is HasWatch {
  return !!plugin.watch;
}


/**
 * A plugin that implements the `clean()` method.
 * @internal
 */
export type HasClean = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "clean">>;

/**
 * Determines whether the given Plugin implements the `clean()` method
 * @internal
 */
export function hasClean(plugin: CodeEnginePlugin): plugin is HasClean {
  return !!plugin.clean;
}


/**
 * A plugin that implements the `dispose()` method.
 * @internal
 */
export type HasDispose = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "dispose">>;

/**
 * Determines whether the given Plugin implements the `dispose()` method
 * @internal
 */
export function hasDispose(plugin: CodeEnginePlugin): plugin is HasDispose {
  return !!plugin.dispose;
}
