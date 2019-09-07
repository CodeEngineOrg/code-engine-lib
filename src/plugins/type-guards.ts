import { DestinationCleaner, FileDestination, FileSource, ParallelProcessor, Plugin, SequentialProcessor } from "./types";

/**
 * Determines whether the given value is a CodeEngine `Plugin` object.
 */
export function isPlugin(value: unknown): value is Plugin {
  let plugin = value as Plugin;
  return plugin &&
    typeof plugin === "object" &&
    typeof plugin.name === "string";
}

/**
 * Determines whether the given Plugin implements the `find()` method
 */
export function isFileSource(plugin: Plugin): plugin is FileSource {
  return !!plugin.find;
}

/**
 * Determines whether the given Plugin implements the `processFile()` method
 */
export function isParallelProcessor(plugin: Plugin): plugin is ParallelProcessor {
  return !!plugin.processFile;
}

/**
 * Determines whether the given Plugin implements the `processAllFiles()` method
 */
export function isSequentialProcessor(plugin: Plugin): plugin is SequentialProcessor {
  return !!plugin.processAllFiles;
}

/**
 * Determines whether the given Plugin implements the `write()` method
 */
export function isFileDestination(plugin: Plugin): plugin is FileDestination {
  return !!plugin.write;
}

/**
 * Determines whether the given Plugin implements the `clean()` method
 */
export function isDestinationCleaner(plugin: Plugin): plugin is DestinationCleaner {
  return !!plugin.clean;
}
