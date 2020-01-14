import { ModuleDefinition, Plugin } from "@code-engine/types";
import { PluginController } from "./plugin-controller";


/**
 * Determines if the given value is a `ModuleDefinition` object,
 * or a string that's shorthand for `ModuleDefinition.moduleId`.
 * @internal
 */
export function isModuleDefinition<T>(value: unknown): value is ModuleDefinition<T> {
  return value && typeof (value as ModuleDefinition<T>).moduleId === "string";
}


/**
 * Determines if the given value is a `Plugin` object.
 * @internal
 */
export function isPlugin(value: unknown): value is Plugin {
  let plugin = value as Plugin;

  // tslint:disable-next-line: cyclomatic-complexity
  return Boolean(plugin &&
    typeof plugin === "object" &&
    (
      // A plugin must implement at least one method
      plugin.processFile || plugin.processFiles ||
      plugin.read || plugin.watch || plugin.clean || plugin.dispose ||
      plugin.start || plugin.finish || plugin.fileChanged
    )
    &&
    (
      plugin.processFile === undefined ||
      typeof plugin.processFile === "function" ||
      typeof plugin.processFile === "string" ||
      isModuleDefinition(plugin.processFile)
    )) &&
    (plugin.processFiles === undefined || typeof plugin.processFiles === "function") &&
    (plugin.read === undefined || typeof plugin.read === "function") &&
    (plugin.watch === undefined || typeof plugin.watch === "function") &&
    (plugin.clean === undefined || typeof plugin.clean === "function") &&
    (plugin.dispose === undefined || typeof plugin.dispose === "function") &&
    (plugin.start === undefined || typeof plugin.start === "function") &&
    (plugin.finish === undefined || typeof plugin.finish === "function") &&
    (plugin.fileChanged === undefined || typeof plugin.fileChanged === "function");
}


/**
 * A plugin that implements the `read()` method.
 * @internal
 */
export type FileSourcePlugin = PluginController & Required<Pick<PluginController, "read">>;

/**
 * Determines whether the given Plugin implements the `read()` method
 * @internal
 */
export function isFileSourcePlugin(plugin: PluginController): plugin is FileSourcePlugin {
  return !!plugin.read;
}


/**
 * A plugin that implements the `processFile()` and/or `processFiles()` methods.
 * @internal
 */
export type FileProcessorPlugin = PluginController &
  (Required<Pick<PluginController, "processFile">> | Required<Pick<PluginController, "processFiles">>);

/**
 * Determines whether the given Plugin implements the `processFile()` and/or `processFiles()` methods.
 * @internal
 */
export function isFileProcessorPlugin(plugin: PluginController): plugin is FileProcessorPlugin {
  return !!plugin.processFile || !!plugin.processFiles;
}


/**
 * A plugin that implements the `watch()` method.
 * @internal
 */
export type WatcherPlugin = PluginController & Required<Pick<PluginController, "watch">>;

/**
 * Determines whether the given Plugin implements the `watch()` method
 * @internal
 */
export function isWatcherPlugin(plugin: PluginController): plugin is WatcherPlugin {
  return !!plugin.watch;
}


/**
 * A plugin that implements the `clean()` method.
 * @internal
 */
export type CleanerPlugin = PluginController & Required<Pick<PluginController, "clean">>;

/**
 * Determines whether the given Plugin implements the `clean()` method
 * @internal
 */
export function isCleanerPlugin(plugin: PluginController): plugin is CleanerPlugin {
  return !!plugin.clean;
}


/**
 * A plugin that implements the `dispose()` method.
 * @internal
 */
export type DisposablePlugin = PluginController & Required<Pick<PluginController, "dispose">>;

/**
 * Determines whether the given Plugin implements the `dispose()` method
 * @internal
 */
export function isDisposablePlugin(plugin: PluginController): plugin is DisposablePlugin {
  return !!plugin.dispose;
}
