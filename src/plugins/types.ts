import { File, FileInfo, FileList } from "../files/types";
import { Logger } from "../loggers/types";

/**
 * A CodeEngine plugin
 */
export interface Plugin {
  /**
   * The plugin name. Used for log messages.
   */
  name?: string;

  /**
   * Glob patterns, regular expressions, or filter functions that limit which files are processed
   * by the plugin's `processFile()` and `processFiles()` methods.
   *
   * Defaults to all files.
   */
  filter?: Filter;

  /**
   * Processes a file that matches the plugin's `filter` criteria. Can be any of the following:
   *
   * - A function that process the file on the main thread
   * - The path of a JavaScript module or Node package that processes the file on a worker thread
   * - An object containing the path of a JavaScript module or Node package, as well as data to pass to it
   *
   */
  processFile?: string | ModuleDefinition | FileProcessor;

  /**
   * Processes all files that match the plugin's `filter` criteria.
   *
   * NOTE: Most plugins should use `processFile()` (singular) instead, which speeds-up the build by
   * allowing the files to be processed in parallel. Using `processFiles()` (plural) forces CodeEngine
   * to wait until all files are ready to be processed.
   */
  processFiles?: FileProcessor;

  /**
   * Finds files to be built from a source, such as the filesystem, a CMS, a database, an RSS feed, etc.
   */
  find?(context: PluginContext): CanIterate<FileInfo>;

  /**
   * Reads the contents of a file from a source, such as the filesystem, a CMS, a database, an RSS feed, etc.
   */
  read?(file: File, context: PluginContext): void | Promise<void>;

  /**
   * Watches source files and notifies CodeEngine when changes are detected.
   */
  watch?(context: PluginContext): CanIterate<FileInfo>;

  /**
   * Writes a file to a destination, such as the filesystem, a CMS, a database, an RSS feed, etc.
   */
  write?(file: File, context: PluginContext): void | Promise<void>;

  /**
   * Deletes existing files from the destination, in preparation for a clean build.
   */
  clean?(context: PluginContext): void | Promise<void>;
}


/**
 * Processes a file, either on the main thread or on a worker thread.
 *
 * @param files
 * A list of files to be processed. You can modify files, delete files, or add new files to the list.
 * For the `Plugin.processFile()` method, this list will always start with a single file.
 */
export type FileProcessor = (files: FileList, context: PluginContext) => void | Promise<void>;


/**
 * A JavaScript module whose default export is a `FileProcessor` or `FileProcessorFactory`.
 */
export interface ModuleDefinition {
  /**
   * A JavaScript module ID, such as the path of a JavaScript file or the name of an NPM package.
   * The module's default export must be a `FileProcessor` or `FileProcessorFactory`.
   */
  moduleId: string;

  /**
   * If the module's default export is a `FileProcessorFactory`, then this data will be passed when
   * calling the factory function. This data can only contain types that are compatible with the
   * Structured Clone Algoritm.
   *
   * NOTE: If `data` is `undefined`, then the module must export a `FileProcessor` directly, not
   * a `FileProcessorFactory`.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
   */
  data?: unknown;
}


/**
 * A function that returns a `FileProcessor`. The default export of a `ModuleDefinition` must
 * match this signature.
 *
 * @param data - The `ModuleDefinition.data` value
 */
export type FileProcessorFactory = (data: unknown) => FileProcessor | Promise<FileProcessor>;


/**
 * A synchronous or asynchronous iterable.
 */
export type AnyIterable<T> = Iterable<T> | AsyncIterable<T>;


/**
 * A synchronous or asynchronous iterator.
 */
export type AnyIterator<T> = Iterator<T> | AsyncIterator<T>;


/**
 * CodeEngine plugins can return files as arrays, Sets, Maps, generators, async generators, or
 * anything else that can be iterated.
 */
export type CanIterate<T> = AnyIterable<T> | AnyIterator<T>;


/**
 * Filters files by their path.  Can be any of the following:
 *
 *    - A boolean to include/exclude all files
 *    - A glob pattern
 *    - A regular expression
 */
export type PathFilter = boolean | string | RegExp;


/**
 * Custom filter criteria for `File` objects
 */
export type FilterFunction = (file: File, files: FileList, context: PluginContext) => unknown;


/**
 * One or more `File` filter criteria
 */
export type FilterCriteria = PathFilter | FilterFunction | Array<PathFilter | FilterFunction>;


/**
 * Explicit inclusion and exclusion filter criteria.
 */
export interface Filters {
  include?: FilterCriteria;
  exclude?: FilterCriteria;
}


/**
 * One or more inclusion/exclusion filter criteria for `File` objects
 */
export type Filter = FilterCriteria | Filters;


/**
 * Contextual information passed to every plugin hook.
 */
export interface PluginContext {
  /**
   * Used to log messages and errors
   */
  readonly logger: Logger;

  /**
   * The directory that should be used to resolve all relative paths.
   */
  readonly cwd: string;

  /**
   * Indicates whether CodeEngine should run in local development mode.
   * When `true`, plugins should generate files that are un-minified, un-obfuscated, and may
   * contain references to localhost.
   */
  readonly dev: boolean;

  /**
   * Indicates whether CodeEngine is running in debug mode, which enables additional logging
   * and error stack traces.
   */
  readonly debug: boolean;
}
