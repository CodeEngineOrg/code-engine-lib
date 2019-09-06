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
