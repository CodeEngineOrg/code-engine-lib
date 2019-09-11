import { LoggerClone, SerializedLogger } from "../loggers";
import { RequestHandlerCallbacks } from "../workers";
import { CodeEnginePluginContext } from "./context";
import { PluginContext } from "./types";

/**
 * A clone of a `PluginContext` object. The clone exists in a worker thread and proxies calls back
 * to the main thread when needed.
 */
export class PluginContextClone extends CodeEnginePluginContext {
  public constructor(serialized: SerializedPluginContext, callbacks: RequestHandlerCallbacks) {
    let logger = new LoggerClone(serialized.logger, callbacks);
    super({ logger });
  }

  /**
   * Serializes the given `PluginContext` object so it can be passed across the thread boundary.
   */
  public static serialize(context: PluginContext): SerializedPluginContext {
    return {
      logger: LoggerClone.serialize(context.logger)
    };
  }
}


/**
 * The data that is sent across the thread boundary between a `CodeEngineWorker` and an `Executor`
 * to represent a `PluginContext` object.
 */
export interface SerializedPluginContext {
  logger: SerializedLogger;
}
