
/**
 * CodeEngine configuration
 */
export interface Config {
  /**
   * The number of worker threads that CodeEngine should use to process files.
   *
   * Defaults to the number of CPU cores available.
   */
  concurrency?: number;
}
