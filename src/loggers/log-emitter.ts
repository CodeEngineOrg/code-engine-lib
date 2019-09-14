import { EventEmitter } from "events";
import { Event } from "../types";
import { LogEventData, Logger, LogLevel } from "./types";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * Emits log messages via an EventEmitter.
 */
export class LogEmitter implements Logger {
  private readonly [_internal]: {
    readonly emitter: EventEmitter;
    readonly debug: boolean;
  };

  public constructor(emitter: EventEmitter, debug: boolean) {
    Object.defineProperty(this, _internal, { value: { emitter, debug }});
  }

  /**
   * Emits a log event with a message and possibly additional data.
   */
  public log(message: string, data?: object | undefined): void {
    let logEventData: LogEventData = { ...data, message, level: LogLevel.Info };
    this[_internal].emitter.emit(Event.Log, logEventData);
  }

  /**
   * Emits a log event, only if debug mode is enabled.
   */
  public debug(message: string, data?: object | undefined): void {
    let { debug, emitter } = this[_internal];

    if (debug) {
      let logEventData: LogEventData = { ...data, message, level: LogLevel.Debug };
      emitter.emit(Event.Log, logEventData);
    }
  }

  /**
   * Emits a log event with a warning message and possibly additional data.
   */
  public warn(warning: string | Error, data?: object | undefined): void {
    let { debug, emitter } = this[_internal];
    let logEventData: LogEventData = { ...data, ...splitError(warning, debug), level: LogLevel.Warning };
    emitter.emit(Event.Log, logEventData);
  }

  /**
   * Emits a log event with an error message and possibly additional data.
   */
  public error(error: string | Error, data?: object | undefined): void {
    let { debug, emitter } = this[_internal];
    let logEventData: LogEventData = { ...data, ...splitError(error, debug), level: LogLevel.Error };
    emitter.emit(Event.Log, logEventData);
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
