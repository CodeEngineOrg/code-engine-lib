/**
 * A summary of a full or incremental build.
 */
export interface BuildSummary {
  /**
   * The number of files that were output.
   */
  fileCount: number;

  /**
   * The total size, in bytes, of all files.
   */
  totalFileSize: number;

  /**
   * How long the build took, in milliseconds.
   */
  took: number;
}
