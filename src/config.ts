/**
 * CodeEngine configuration
 */
export interface Config {
  /**
   * The directory used to resolve all relative paths.
   *
   * Defaults to `process.cwd()`.
   */
  cwd?: string;

  /**
   * The number of worker threads that CodeEngine should use to process files.
   *
   * Defaults to the number of CPU cores available.
   */
  concurrency?: number;

  /**
   * Indicates whether CodeEngine should run in local development mode.
   * When `true`, many plugins will generate files that are un-minified, un-obfuscated, and may
   * contain references to localhost.
   *
   * Defaults to `false` unless the NODE_ENV environment variable is set to "development".
   */
  dev?: boolean;

  /**
   * Indicates whether CodeEngine is running in debug mode, which enables additional logging
   * and error stack traces.
   *
   * Defaults to `false` unless the DEBUG environment variable is set to a non-empty value.
   */
  debug?: boolean;
}
