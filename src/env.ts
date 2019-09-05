/**
 * Information about the CodeEngine runtime environment
 */
export interface Environment {
  /**
   * Are we running on Windows?
   */
  readonly isWindows: boolean;

  /**
   * Indicates whether CodeEngine is running in local development mode.
   * When `true`, generated files will be un-compressed, un-minified, and may contain references
   * to localhost.
   */
  readonly isDev: boolean;

  /**
   * Indicates whether CodeEngine is running in debug mode, which enables additional logging
   * and error stack traces.
   */
  readonly isDebug: boolean;
}

/**
 * Information about the CodeEngine runtime environment
 */
export const env: Environment = {
  isWindows: process.platform === "win32",
  isDev: process.env.NODE_ENV === "development",
  isDebug: process.env.DEBUG === "true",
};
