import { LogEventData, Logger } from "@code-engine/types";
import { EventEmitter } from "events";

/**
 * Emits log messages via an EventEmitter.
 * @internal
 */
export class LogEmitter implements Logger {
  private readonly _emitter: EventEmitter;
  private readonly _debug: boolean;

  public constructor(emitter: EventEmitter, debug: boolean) {
    this._emitter = emitter;
    this._debug = debug;
  }

  /**
   * Emits a log event with a message and possibly additional data.
   */
  public log(message: string, data?: object | undefined): void {
    let logEventData: LogEventData = { ...data, message, level: "info" };
    this._emitter.emit("log", logEventData);
  }

  /**
   * Emits a log event, only if debug mode is enabled.
   */
  public debug(message: string, data?: object | undefined): void {
    if (this._debug) {
      let logEventData: LogEventData = { ...data, message, level: "debug" };
      this._emitter.emit("log", logEventData);
    }
  }

  /**
   * Emits a log event with a warning message and possibly additional data.
   */
  public warn(warning: string | Error, data?: object | undefined): void {
    let logEventData: LogEventData = { ...data, ...splitError(warning, this._debug), level: "warning" };
    this._emitter.emit("log", logEventData);
  }

  /**
   * Emits a log event with an error message and possibly additional data.
   */
  public error(error: string | Error, data?: object | undefined): void {
    let logEventData: LogEventData = { ...data, ...splitError(error, this._debug), level: "error" };
    this._emitter.emit("log", logEventData);
  }
}

/**
 * Splits an Error or error message into two separate values.
 */
export function splitError(arg: string | Error, debug: boolean) {
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
