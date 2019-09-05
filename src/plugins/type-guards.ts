import { Plugin } from "./types";

/**
 * A plugin that implements the `find()` method.
 */
export type FileSource = Plugin & Required<Pick<Plugin, "find">>;

/**
 * Determines whether the given Plugin implements the `find()` method
 */
export function isFileSource(plugin: Plugin): plugin is FileSource {
  return !!plugin.find;
}

/**
 * A plugin that implements the `processFile()` method.
 */
export type ParallelProcessor = Plugin & Required<Pick<Plugin, "processFile">>;

/**
 * Determines whether the given Plugin implements the `processFile()` method
 */
export function isParallelProcessor(plugin: Plugin): plugin is ParallelProcessor {
  return !!plugin.processFile;
}

/**
 * A plugin that implements the `processAllFiles()` method.
 */
export type SequentialProcessor = Plugin & Required<Pick<Plugin, "processAllFiles">>;

/**
 * Determines whether the given Plugin implements the `processAllFiles()` method
 */
export function isSequentialProcessor(plugin: Plugin): plugin is SequentialProcessor {
  return !!plugin.processAllFiles;
}

/**
 * A plugin that implements the `write()` method.
 */
export type FileDestination = Plugin & Required<Pick<Plugin, "write">>;

/**
 * Determines whether the given Plugin implements the `write()` method
 */
export function isFileDestination(plugin: Plugin): plugin is FileDestination {
  return !!plugin.write;
}

/**
 * A plugin that implements the `clean()` method.
 */
export type DestinationCleaner = Plugin & Required<Pick<Plugin, "clean">>;

/**
 * Determines whether the given Plugin implements the `clean()` method
 */
export function isDestinationCleaner(plugin: Plugin): plugin is DestinationCleaner {
  return !!plugin.clean;
}
