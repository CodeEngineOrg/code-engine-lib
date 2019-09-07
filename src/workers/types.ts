import { ErrorPOJO } from "ono";
import { CodeEngine } from "../code-engine";
import { ParallelPlugin } from "../plugins";

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
   * A unique ID assigned to each worker.
   */
  id: number;

  /**
   * The directory used to resolve all relative paths.
   *
   * Defaults to `process.cwd()`.
   */
  cwd: string;
}

/**
 * Events that occur on a `CodeEngineWorker` or `Executor`.
 */
export enum WorkerEvent {
  Online = "online",
  Terminated = "terminated",
  LoadPlugin = "loadPlugin",
}

/**
 * A message sent from a `CodeEngineWorker` to an `Executor`
 */
export interface PostMessage {
  event: WorkerEvent;
  data?: unknown;
}

/**
 * A message that has been sent from a `CodeEngineWorker` to an `Executor`, but has't been responded to yet.
 */
export interface PendingMessage {
  /**
   * The event that the message is for.
   */
  event: WorkerEvent;

  /**
   * Resolves the pending Promise when a response is received from the `Executor`.
   */
  resolve(value: unknown): void;

  /**
   * Rejects the pending Promise when an error occurs or the thread is terminated.
   */
  reject(reason: ErrorPOJO): void;
}

/**
 * A request received by an `Executor` from a `CodeEngineWorker`.
 */
export interface ExecutorRequest extends PostMessage {
  id: number;
}

/**
 * A response sent by an `Executor` to a `CodeEngineWorker`.
 */
export interface ExecutorResponse {
  id: number;
  error?: ErrorPOJO;
  value?: unknown;
}

/**
 * An object that indicates which methods are implemented by a `ParallelPlugin`.
 */
export type ParallelPluginSignature = {
  // Make all properties required
  [k in keyof ParallelPlugin]-?:
    // Copy primitive properties (i.e. `name`) as-is, but convert everything else (i.e. methods) to booleans
    ParallelPlugin[k] extends string | number | boolean ? ParallelPlugin[k] : boolean;
};
