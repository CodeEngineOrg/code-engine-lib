import { ErrorPOJO } from "ono";

export interface PostMessage {
  event: WorkerEvent;
  data?: unknown;
}

export interface WorkerRequest extends PostMessage {
  id: number;
}

export interface WorkerResponse {
  id: number;
  error?: ErrorPOJO;
  value?: unknown;
}

export enum WorkerEvent {
  Online,
}
