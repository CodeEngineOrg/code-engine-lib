import { LoggerClone, SerializedLogger } from "../loggers/logger-clone";
import { RequestHandlerCallbacks } from "../workers/messenger";
import { CodeEnginePluginContext } from "./context";
import { PluginContext } from "./types";

/**
 * A clone of a `PluginContext` object. The clone exists in a worker thread and proxies calls back
 * to the main thread when needed.
 */
export class PluginContextClone extends CodeEnginePluginContext {
  public constructor(serialized: SerializedPluginContext, callbacks: RequestHandlerCallbacks) {
    super({
      ...serialized,
      logger: new LoggerClone(serialized, callbacks),
    });
  }

  /**
   * Serializes the given `PluginContext` object so it can be passed across the thread boundary.
   */
  public static serialize(context: PluginContext): SerializedPluginContext {
    return {
      ...context,
      logger: LoggerClone.serialize(context.logger),
    };
  }
}


/**
 * The data that is sent across the thread boundary between a `CodeEngineWorker` and an `Executor`
 * to represent a `PluginContext` object.
 */
export interface SerializedPluginContext {
  logger: SerializedLogger;
  cwd: string;
  dev: boolean;
  debug: boolean;
}
