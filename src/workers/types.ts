import { ErrorPOJO } from "ono";

/**
 * TODO
 */
export interface PostMessage {
  event: WorkerEvent;
  data?: unknown;
}

/**
 * TODO
 */
export interface WorkerRequest extends PostMessage {
  id: number;
}

/**
 * TODO
 */
export interface WorkerResponse {
  id: number;
  error?: ErrorPOJO;
  value?: unknown;
}

/**
 * TODO
 */
export enum WorkerEvent {
  Online,
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
