import { Plugin } from "./types";

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
export type FileProcessor = Plugin & Required<Pick<Plugin, "processFile">>;

/**
 * Determines whether the given Plugin implements the `processFile()` method
 */
export function isFileProcessor(plugin: Plugin): plugin is FileProcessor {
  return !!plugin.processFile;
}


/**
 * A plugin that implements the `processAllFiles()` method.
 */
export type FileListProcessor = Plugin & Required<Pick<Plugin, "processAllFiles">>;

/**
 * Determines whether the given Plugin implements the `processAllFiles()` method
 */
export function isFileListProcessor(plugin: Plugin): plugin is FileListProcessor {
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
