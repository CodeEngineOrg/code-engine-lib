import { ErrorPOJO } from "ono";

/**
 * Events that occur on a `CodeEngineWorker` or `Executor`.
 */
export enum WorkerEvent {
  Online = "online",
  Terminated = "terminated",
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
