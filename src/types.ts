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
}

/**
 * Events that can be emitted by a CodeEngine instance.
 */
export enum Event {
  Log = "log",
  Error = "error",
}
