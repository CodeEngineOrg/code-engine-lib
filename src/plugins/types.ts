import { File, FileInfo, FileList } from "../files";
import { Logger } from "../loggers";

/**
 * A plugin for CodeEngine to use. Can be a `Plugin` object that runs on the main thread,
 * or a JavaScript module to load a `ParallelPlugin` that runs on worker threads.
 */
export type UsePlugin = Plugin | ParallelPluginModule | string;


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
 * The common properties that can exist on all CodeEngine plugins
 */
export interface BasePlugin {
  /**
   * The plugin name. Used for log messages.
   */
  readonly name: string;
}


/**
 * A CodeEngine plugin
 */
export interface Plugin extends BasePlugin {
  /**
   * Finds files to be built from a source, such as the filesystem, a CMS, a database, an RSS feed, etc.
   */
  find?(context: PluginContext): CanIterate<FileInfo>;

  /**
   * Watches source files and notifies CodeEngine when changes are detected.
   */
  watch?(context: PluginContext): CanIterate<FileInfo[]>;

  /**
   * Processes a file. Depending on the plugin, this may alter the file's path or metadata,
   * edit its contents, add new files, or even delete the file.
   */
  processFile?(file: File, context: PluginContext): void | Promise<void>;

  /**
   * Processes the list of all files.
   *
   * NOTE: Most plugins should use `processFile()` instead, which speeds-up the build by allowing
   * multiple files to be processed in parallel. Using `processAllFiles()` forces CodeEngine to
   * puase processing until all files are ready to be processed.
   */
  processAllFiles?(files: FileList, context: PluginContext): void | Promise<void>;

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
 * A plugin that implements the `find()` method.
 */
export type FileSource = Plugin & Required<Pick<Plugin, "find">>;


/**
 * A plugin that implements the `processFile()` method.
 */
export type ParallelProcessor = Plugin & Required<Pick<Plugin, "processFile">>;


/**
 * A plugin that implements the `processAllFiles()` method.
 */
export type SequentialProcessor = Plugin & Required<Pick<Plugin, "processAllFiles">>;


/**
 * A plugin that implements the `write()` method.
 */
export type FileDestination = Plugin & Required<Pick<Plugin, "write">>;


/**
 * A plugin that implements the `clean()` method.
 */
export type DestinationCleaner = Plugin & Required<Pick<Plugin, "clean">>;


/**
 * A CodeEngine plugin that runs on a worker thread.
 */
export interface ParallelPlugin extends BasePlugin {
  /**
   * Processes a file. Depending on the plugin, this may alter the file's path or metadata,
   * edit its contents, add new files, or even delete the file.
   */
  processFile?(file: File, context: PluginContext): void | Promise<void>;
}


/**
 * A JavaScript module whose default export is a function that returns a `ParallelPlugin`.
 */
export interface ParallelPluginModule {
  /**
   * A JavaScript module ID, such as the path of a JavaScript file or the name of an NPM package.
   * The module's default export must be a function that returns a `ParallelPlugin`.
   */
  moduleId: string;

  /**
   * Optional data to be passed when invoking the module's exported function. This data can only
   * contain types that are compatible with the Structured Clone Algoritm.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm
   */
  data?: unknown;
}


/**
 * A function that returns a `ParallelPlugin`. The default export of a `ParallelPluginModule` must
 * match this signature.
 *
 * @param data - The `ParallelPluginModule.data` value
 */
export type ParallelPluginFactory = (data: unknown) => ParallelPlugin | Promise<ParallelPlugin>;


/**
 * Contextual information passed to every plugin hook.
 */
export interface PluginContext {
  /**
   * Used to log messages and errors
   */
  logger: Logger;
}


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
 * The name of a `ParallelPlugin` method.
 */
export type ParallelPluginMethod = MethodNames<ParallelPlugin>;
