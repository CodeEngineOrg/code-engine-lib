import { EventEmitter } from "events";
import { LogEventData } from ".";
import { RequestHandlerCallbacks, serialize, WorkerEvent } from "../workers";
import { LogEmitter } from "./log-emitter";
import { Logger } from "./types";

/**
 * A clone of a `Logger` object. The clone exists in a worker thread and proxies calls back
 * to the main thread when needed.
 */
export class LoggerClone extends LogEmitter {
  public constructor(serialized: SerializedLogger, callbacks: RequestHandlerCallbacks) {
    let emitter = new EventEmitter();
    super(emitter);

    // Forward "log" events across the thread boundary
    emitter.on(WorkerEvent.Log, async (logEventData: LogEventData) => {
      try {
        await callbacks.sendSubRequest({ event: WorkerEvent.Log, data: serialize(logEventData) });
      }
      catch (err) {
        callbacks.error(err);
      }
    });
  }

  /**
   * Serializes the given `Logger` object so it can be passed across the thread boundary.
   */
  public static serialize(logger: Logger): SerializedLogger {
    return;
  }
}


/**
 * The data that is sent across the thread boundary between a `CodeEngineWorker` and an `Executor`
 * to represent a `Logger` object.
 */
export type SerializedLogger = undefined;
