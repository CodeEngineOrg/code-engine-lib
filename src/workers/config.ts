/**
 * Initialization configuration that is passed from CodeEngine to its worker threds.
 */
export interface WorkerConfig {
  /**
   * A unique ID assigned to each worker.
   */
  id: number;
}
