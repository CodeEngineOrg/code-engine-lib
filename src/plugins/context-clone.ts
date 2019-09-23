import { LoggerClone, SerializedLogger } from "../loggers/logger-clone";
import { RequestHandlerCallbacks } from "../workers/messenger";
import { CodeEngineContext } from "./context";
import { Context } from "./types";

/**
 * A clone of a `Context` object. The clone exists in a worker thread and proxies calls back
 * to the main thread when needed.
 */
export class ContextClone extends CodeEngineContext {
  public constructor(serialized: SerializedContext, callbacks: RequestHandlerCallbacks) {
    super({
      ...serialized,
      logger: new LoggerClone(serialized, callbacks),
    });
  }

  /**
   * Serializes the given `Context` object so it can be passed across the thread boundary.
   */
  public static serialize(context: Context): SerializedContext {
    return {
      ...context,
      logger: LoggerClone.serialize(context.logger),
    };
  }
}


/**
 * The data that is sent across the thread boundary between a `CodeEngineWorker` and an `Executor`
 * to represent a `Context` object.
 */
export interface SerializedContext {
  logger: SerializedLogger;
  cwd: string;
  dev: boolean;
  debug: boolean;
}
