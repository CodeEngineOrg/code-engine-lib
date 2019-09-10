import { CodeEngine } from "../code-engine";

/**
 * Configuration for a `WorkerPool`.
 */
export interface WorkerPoolConfig {
  /**
   * The directory used to resolve all relative paths.
   *
   * Defaults to `process.cwd()`.
   */
  cwd: string;

  /**
   * The number of worker threads that CodeEngine should use to process files.
   *
   * Defaults to the number of CPU cores available.
   */
  concurrency?: number;

  /**
   * The CodeEngine instance that the `WorkerPool` belongs to.
   */
  engine: CodeEngine;
}


/**
 * Configuration for a `CodeEngineWorker`.
 */
export interface WorkerConfig {
  /**
   * The directory used to resolve all relative paths.
   *
   * Defaults to `process.cwd()`.
   */
  cwd: string;

  /**
   * The CodeEngine instance that the `CodeEngineWorker` belongs to.
   */
  engine: CodeEngine;
}


/**
 * Configuration for an `Executor` running in a worker thread.
 */
export interface ExecutorConfig {
  /**
   * The directory used to resolve all relative paths.
   *
   * Defaults to `process.cwd()`.
   */
  cwd: string;
}
