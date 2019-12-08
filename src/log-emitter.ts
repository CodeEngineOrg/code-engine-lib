import { EventName, LogEventData, Logger, LogLevel } from "@code-engine/types";
import { EventEmitter } from "events";

/**
 * Emits log messages via an EventEmitter.
 * @internal
 */
export function createLogEmitter(emitter: EventEmitter, debug: boolean): Logger {
  function log(message: string | Error, data?: object): void {
    if (typeof message === "string") {
      log.info(message, data);
    }
    else {
      log.error(message, data);
    }
  }

  log.info = (message: string, data?: object | undefined) => {
    let logEventData: LogEventData = { ...data, message, level: LogLevel.Info };
    emitter.emit(EventName.Log, logEventData);
  };

  log.debug = (message: string, data?: object | undefined) => {
    if (debug) {
      let logEventData: LogEventData = { ...data, message, level: LogLevel.Debug };
      emitter.emit(EventName.Log, logEventData);
    }
  };

  log.warn = (warning: string | Error, data?: object | undefined) => {
    let logEventData: LogEventData = { ...data, ...splitError(warning, debug), level: LogLevel.Warning };
    emitter.emit(EventName.Log, logEventData);
  };

  log.error = (error: string | Error, data?: object | undefined) => {
    let logEventData: LogEventData = { ...data, ...splitError(error, debug), level: LogLevel.Error };
    emitter.emit(EventName.Log, logEventData);
  };

  return log;
}

/**
 * Splits an Error or error message into two separate values.
 */
function splitError(arg: string | Error, debug: boolean) {
  if (typeof arg === "string") {
    return { message: arg };
  }
  else {
    let error = arg;
    let message = arg.message || String(arg);

    if (debug) {
      message = arg.stack || message;
    }

    return { message, error };
  }
}
