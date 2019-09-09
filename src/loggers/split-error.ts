import { env } from "../env";

/**
 * Splits an Error or error message into two separate values.
 */
export function splitError(arg: string | Error) {
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
