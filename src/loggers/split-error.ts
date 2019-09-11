import { env } from "../env";

/**
 * Splits an Error or error message into two separate values.
 */
export function splitError(arg: string | Error) {
  if (typeof arg === "string") {
    return { message: arg };
  }
  else {
    let error = arg;
    let message = arg.message || String(arg);

    if (env.isDebug) {
      message = arg.stack || message;
    }

    return { message, error };
  }
}
