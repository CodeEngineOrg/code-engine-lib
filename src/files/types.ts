/**
 * The information necessary to create a `File` object.
 */
export interface FileInfo {
  path: string;
  createdAt?: Date;
  modifiedAt?: Date;
  metadata?: FileMetadata;
  contents?: string | Buffer;
}


/**
 * Arbitrary file metadata that can be added by plugins.
 */
export type FileMetadata = Record<string, unknown>;


/**
 * A CodeEngine file. This does not necessarily correspond to a file on disk.
 * Files are a virtual concept with a path, name, and data contents. Those values could
 * come from a database, a CMS, an RSS feed, or any other source.
 */
export interface File {
  /**
   * Returns the complete path and file name.
   *
   * @example
   *  index.html
   *  css/styles.min.css
   *  img/logos/vector.svg
   */
  path: string;

  /**
   * The directory path, relative to the destination.
   *
   * @example
   *  index.html            =>  (empty string)
   *  css/styles.min.css    =>  css
   *  img/logos/vector.svg  =>  img/logos
   */
  dir: string;

  /**
   * The file name including extension (if any)
   *
   * @example
   *  index.html            =>  index.html
   *  css/styles.min.css    =>  styles.min.css
   *  img/logos/vector.svg  =>  vector.svg
   */
  name: string;

  /**
   * The file extension (if any)
   *
   * @example
   *  index.html            =>  .html
   *  css/styles.min.css    =>  .css
   *  img/logos/vector.svg  =>  .svg
   */
  extension: string;

  /**
   * The date and time that the file was first created at its source.
   */
  createdAt: Date;

  /**
   * The date and time that the file was last modified at its source.
   */
  modifiedAt: Date;

  /**
   * Arbitrary metadata that can be added by plugins.
   */
  metadata: FileMetadata;

  /**
   * The file's contents.
   */
  contents: Buffer;
}


/**
 * An unordered list of unique `File` objects.
 */
export interface FileList extends Iterable<File> {
  /**
   * The number of files in the list.
   */
  size: number;

  /**
   * Iterates over the files in the list.
   */
  [Symbol.iterator](): Iterator<File>;

  /**
   * Returns the path of each file in the list.
   */
  keys(): Iterator<string>;

  /**
   * Returns each file in the list.
   */
  values(): Iterator<File>;

  /**
   * Returns each path and file in the list.
   */
  entries(): Iterator<[string, File]>;

  /**
   * Adds the given file to the list.
   */
  add(file: File): this;

  /**
   * Determines whether the specified file exists in the list.
   */
  has(file: string | File): boolean;

  /**
   * Returns the specified file in the list, or `undefined` if not found.
   */
  get(file: string | File): File | undefined;

  /**
   * Returns the specified file in the list. Throws an error if not found.
   */
  demand(file: string | File): File;

  /**
   * Returns a file in the list where predicate is true, or `undefined` otherwise.
   */
  // tslint:disable-next-line: max-line-length
  find<F extends File, T = void>(predicate: (this: T, file: File, files: FileList) => file is F, thisArg?: T): F | undefined;

  /**
   * Returns a file in the list where predicate is true, or `undefined` otherwise.
   */
  find<T = void>(predicate: (this: T, file: File, files: FileList) => unknown, thisArg?: T): File | undefined;

  /**
   * Determines whether every file in the list satisfies the specified test.
   */
  every<T = void>(predicate: (this: T, file: File, files: FileList) => unknown, thisArg?: T): boolean;

  /**
   * Determines whether any file in the list satisfies the specified test.
   */
  some<T = void>(predicate: (this: T, file: File, files: FileList) => unknown, thisArg?: T): boolean;

  /**
   * Performs the specified action for each file in the list.
   */
  forEach<T = void>(iterator: (this: T, file: File, files: FileList) => void, thisArg?: T): void;

  /**
   * Maps each file in the list to value, and returns the array of values.
   */
  map<U, T = void>(mapper: (this: T, file: File, files: FileList) => U, thisArg?: T): U[];

  /**
   * Returns the files that satisfy the specified test.
   */
  filter<T = void>(predicate: (this: T, file: File, files: FileList) => unknown, thisArg?: T): FileList;

  /**
   * Reduces the file list to a single result.
   */
  reduce(reducer: (previousFile: File, currentFile: File, files: FileList) => File): File;

  /**
   * Reduces the file list to a single result.
   */
  reduce(reducer: (previousFile: File, currentFile: File, files: FileList) => File, initialValue: File): File;

  /**
   * Reduces the file list to a single result.
   */
  reduce<U>(reducer: (accumulator: U, file: File, files: FileList) => U, initialValue: U): U;

  /**
   * Returns a string consisting of all the elements of the list, separated by the specified separator.
   */
  join(separator?: string): string;

  /**
   * Removes the specified file from the list.
   *
   * @returns `true` if the file was deleted from the list, or `false` if the file was not in the list.
   */
  delete(file: string | File): boolean;

  /**
   * Removes all files from the list.
   */
  clear(): void;
}
