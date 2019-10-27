import { ModuleDefinition, Plugin } from "@code-engine/types";
import { PluginController } from "./plugin-controller";


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
  return Boolean(plugin &&
    typeof plugin === "object" &&
    (
      // A plugin must implement at least one method
      plugin.read || plugin.watch || plugin.clean || plugin.dispose ||
      plugin.processFile || plugin.processFiles
    )
    &&
    (plugin.read === undefined || typeof plugin.read === "function") &&
    (plugin.watch === undefined || typeof plugin.watch === "function") &&
    (plugin.clean === undefined || typeof plugin.clean === "function") &&
    (plugin.dispose === undefined || typeof plugin.dispose === "function") &&
    (plugin.processFiles === undefined || typeof plugin.processFiles === "function") &&
    (
      plugin.processFile === undefined ||
      typeof plugin.processFile === "function" ||
      isModuleDefinition(plugin.processFile)
    ));
}


/**
 * A plugin that implements the `read()` method.
 * @internal
 */
export type FileSource = PluginController & Required<Pick<PluginController, "read">>;

/**
 * Determines whether the given Plugin implements the `read()` method
 * @internal
 */
export function isFileSource(plugin: PluginController): plugin is FileSource {
  return !!plugin.read;
}


/**
 * A plugin that implements the `processFile()` and/or `processFiles()` methods.
 * @internal
 */
export type BuildStep = PluginController &
  (Required<Pick<PluginController, "processFile">> | Required<Pick<PluginController, "processFiles">>);

/**
 * Determines whether the given Plugin implements the `processFile()` and/or `processFiles()` methods.
 * @internal
 */
export function isBuildStep(plugin: PluginController): plugin is BuildStep {
  return !!plugin.processFile || !!plugin.processFiles;
}


/**
 * A plugin that implements the `watch()` method.
 * @internal
 */
export type HasWatch = PluginController & Required<Pick<PluginController, "watch">>;

/**
 * Determines whether the given Plugin implements the `watch()` method
 * @internal
 */
export function hasWatch(plugin: PluginController): plugin is HasWatch {
  return !!plugin.watch;
}


/**
 * A plugin that implements the `clean()` method.
 * @internal
 */
export type HasClean = PluginController & Required<Pick<PluginController, "clean">>;

/**
 * Determines whether the given Plugin implements the `clean()` method
 * @internal
 */
export function hasClean(plugin: PluginController): plugin is HasClean {
  return !!plugin.clean;
}


/**
 * A plugin that implements the `dispose()` method.
 * @internal
 */
export type HasDispose = PluginController & Required<Pick<PluginController, "dispose">>;

/**
 * Determines whether the given Plugin implements the `dispose()` method
 * @internal
 */
export function hasDispose(plugin: PluginController): plugin is HasDispose {
  return !!plugin.dispose;
}
