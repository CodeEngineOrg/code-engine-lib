/**
 * Writes log messages
 */
export interface Logger {
  /**
   * Logs a message.
   *
   * @param message - The message to log
   * @param data - An optional POJO containing additional information
   */
  log(message: string, data?: object): void;

  /**
   * Logs a message, only if debug mode is enabled.
   *
   * @param message - The message to log
   * @param data - An optional POJO containing additional information
   */
  debug(message: string, data?: object): void;

  /**
   * Logs a warning
   *
   * @param warning - The warning to log
   * @param data - An optional POJO containing additional information
   */
  warn(warning: string | Error, data?: object): void;

  /**
   * Logs an error
   *
   * @param error - The error to log
   * @param data - An optional POJO containing additional information
   */
  error(error: string | Error, data?: object): void;
}
