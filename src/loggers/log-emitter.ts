import { EventEmitter } from "events";
import { env } from "../env";
import { Events } from "../events";
import { LogLevels } from "./log-levels";
import { Logger } from "./types";

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
    this[_internal].emitter.emit(Events.Log, { ...data, message, level: LogLevels.Info });
  }

  /**
   * Emits a log event, only if debug mode is enabled.
   */
  public debug(message: string, data?: object | undefined): void {
    if (env.isDebug) {
      this[_internal].emitter.emit(Events.Log, { ...data, message, level: LogLevels.Debug });
    }
  }

  /**
   * Emits a log event with a warning message and possibly additional data.
   */
  public warn(warning: string | Error, data?: object | undefined): void {
    this[_internal].emitter.emit(Events.Log, { ...data, ...splitErrorMessage(warning), level: LogLevels.Warning });
  }

  /**
   * Emits a log event with an error message and possibly additional data.
   */
  public error(error: string | Error, data?: object | undefined): void {
    this[_internal].emitter.emit(Events.Log, { ...data, ...splitErrorMessage(error), level: LogLevels.Error });
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
