import { EventEmitter } from "events";
import { env } from "../env";
import { Event } from "../types";
import { Logger, LogLevel } from "./types";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * Emits log messages via an EventEmitter.
 */
export class LogEmitter implements Logger {
  private readonly [_internal]: {
    readonly emitter: EventEmitter;
  };

  public constructor(emitter: EventEmitter) {
    Object.defineProperty(this, _internal, { value: {
      emitter,
    }});
  }

  /**
   * Emits a log event with a message and possibly additional data.
   */
  public log(message: string, data?: object | undefined): void {
    this[_internal].emitter.emit(Event.Log, { ...data, message, level: LogLevel.Info });
  }

  /**
   * Emits a log event, only if debug mode is enabled.
   */
  public debug(message: string, data?: object | undefined): void {
    if (env.isDebug) {
      this[_internal].emitter.emit(Event.Log, { ...data, message, level: LogLevel.Debug });
    }
  }

  /**
   * Emits a log event with a warning message and possibly additional data.
   */
  public warn(warning: string | Error, data?: object | undefined): void {
    this[_internal].emitter.emit(Event.Log, { ...data, ...splitErrorMessage(warning), level: LogLevel.Warning });
  }

  /**
   * Emits a log event with an error message and possibly additional data.
   */
  public error(error: string | Error, data?: object | undefined): void {
    this[_internal].emitter.emit(Event.Log, { ...data, ...splitErrorMessage(error), level: LogLevel.Error });
  }
}

/**
 * Splits an Error or error message into two separate values.
 */
export function splitErrorMessage(arg: string | Error) {
  let message: string, error: Error | undefined;

  if (typeof arg === "string") {
    message = arg;
  }
  else {
    error = arg;
    message = arg.message || String(arg);

    if (env.isDebug) {
      message = arg.stack || message;
    }
  }

  return { message, error };
}
