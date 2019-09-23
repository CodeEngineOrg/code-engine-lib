import { CodeEnginePlugin } from "./plugins/plugin";

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
export type HasProcessFile = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "processFile">>;

/**
 * Determines whether the given Plugin implements the `processFile()` method
 */
export function hasProcessFile(plugin: CodeEnginePlugin): plugin is HasProcessFile {
  return !!plugin.processFile;
}


/**
 * A plugin that implements the `processFiles()` method.
 */
export type HasProcessFiles = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "processFiles">>;

/**
 * Determines whether the given Plugin implements the `processFiles()` method
 */
export function hasProcessFiles(plugin: CodeEnginePlugin): plugin is HasProcessFiles {
  return !!plugin.processFiles;
}


/**
 * A plugin that implements the `watch()` method.
 */
export type HasWatch = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "watch">>;

/**
 * Determines whether the given Plugin implements the `watch()` method
 */
export function hasWatch(plugin: CodeEnginePlugin): plugin is HasWatch {
  return !!plugin.watch;
}


/**
 * A plugin that implements the `stopWatching()` method.
 */
export type HasStopWatching = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "stopWatching">>;

/**
 * Determines whether the given Plugin implements the `stopWatching()` method
 */
export function hasStopWatching(plugin: CodeEnginePlugin): plugin is HasStopWatching {
  return !!plugin.stopWatching;
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
export type HasClean = CodeEnginePlugin & Required<Pick<CodeEnginePlugin, "clean">>;

/**
 * Determines whether the given Plugin implements the `clean()` method
 */
export function hasClean(plugin: CodeEnginePlugin): plugin is HasClean {
  return !!plugin.clean;
}
