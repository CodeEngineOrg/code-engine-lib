import { CodeEngineWorker } from "./worker";

/**
 * Returns a Promise that resolves when the given Worker comes online,
 * or rejects if the worker errors or exits first.
 */
// tslint:disable-next-line: promise-function-async
export function awaitOnline(worker: CodeEngineWorker): Promise<void> {
  let promise = new Promise<void>((resolve, reject) => {
    // Reject if the worker errors before coming online
    worker.once("error", reject);

    // Reject if the worker exits before coming online
    worker.once("exit", exitHandler);

    // Resolve the promise when the worker comes online
    worker.once("online", () => {
      resolve();

      // Remove the other event handlers
      worker.off("error", reject);
      worker.off("exit", exitHandler);
    });

    function exitHandler(exitCode: number) {
      reject(new Error(`CodeEngine worker #${worker.id} exited with code ${exitCode} before coming online.`));
    }
  });

  // Ensure that there's at least one rejection handler;
  // otherwise, Node will crash the process
  promise.catch(() => undefined);

  return promise;
}
