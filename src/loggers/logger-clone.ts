import { EventEmitter } from "events";
import { SerializedPluginContext } from "../plugins/context-clone";
import { RequestHandlerCallbacks } from "../workers/messenger";
import { serialize } from "../workers/serialization";
import { WorkerEvent } from "../workers/types";
import { LogEmitter } from "./log-emitter";
import { LogEventData, Logger } from "./types";

/**
 * A clone of a `Logger` object. The clone exists in a worker thread and mirrors a `Logger` that
 * exists on the main thread.
 */
export class LoggerClone extends LogEmitter {
  public constructor(serialized: SerializedPluginContext, callbacks: RequestHandlerCallbacks) {
    let emitter = new EventEmitter();
    super(emitter, serialized.debug);

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
