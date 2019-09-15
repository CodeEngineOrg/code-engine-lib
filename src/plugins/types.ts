import { File, FileInfo, FileList } from "../files";
import { Logger } from "../loggers";


/**
 * The common properties that can exist on all CodeEngine plugins
 */
export interface BasePlugin {
  /**
   * The plugin name. Used for log messages.
   */
  name?: string;
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
   * Reads the contents of a file from a source, such as the filesystem, a CMS, a database, an RSS feed, etc.
   */
  read?(file: File, context: PluginContext): undefined | string | Buffer | Promise<undefined | string | Buffer>;

  /**
   * Watches source files and notifies CodeEngine when changes are detected.
   */
  watch?(context: PluginContext): CanIterate<FileInfo>;

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
 * A CodeEngine plugin that runs on a worker thread.
 */
export interface WorkerPlugin extends BasePlugin {
  /**
   * Processes a file. Depending on the plugin, this may alter the file's path or metadata,
   * edit its contents, add new files, or even delete the file.
   */
  processFile?(file: File, context: PluginContext): void | Promise<void>;
}


/**
 * A JavaScript module whose default export is a function that returns a `WorkerPlugin`.
 */
export interface WorkerPluginModule {
  /**
   * A JavaScript module ID, such as the path of a JavaScript file or the name of an NPM package.
   * The module's default export must be a function that returns a `WorkerPlugin`.
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
 * A function that returns a `WorkerPlugin`. The default export of a `WorkerPluginModule` must
 * match this signature.
 *
 * @param data - The `WorkerPluginModule.data` value
 */
export type WorkerPluginFactory = (data: unknown) => WorkerPlugin | Promise<WorkerPlugin>;


/**
 * A plugin for CodeEngine to use. Can be a `Plugin` object that runs on the main thread,
 * or a JavaScript module to load a `WorkerPlugin` that runs on worker threads.
 */
export type UsePlugin = Plugin | WorkerPluginModule | string;


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
 * The name of a `WorkerPlugin` method.
 */
export type WorkerPluginMethod = MethodNames<WorkerPlugin>;
