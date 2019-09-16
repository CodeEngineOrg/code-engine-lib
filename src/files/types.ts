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
   * Returns the original value of the `path` property when the file was first created.
   */
  readonly originalPath: string;

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
 * The information necessary to create a `File` object.
 */
export interface FileInfo {
  path: string;
  createdAt?: Date;
  modifiedAt?: Date;
  metadata?: FileMetadata;
  contents?: string | Buffer | Uint8Array | ArrayBuffer;
}


/**
 * Arbitrary file metadata that can be added by plugins.
 */
export type FileMetadata = Record<string, unknown>;


/**
 * The fields of a `File` object that can be used when searching a `FileList`.
 */
export type FilePathField = "path" | "originalPath";


/**
 * A function that evaluates each `File` in a `FileList`.
 */
export type FileIterator<TContext = void, TReturn = unknown> = (this: TContext, file: File, files: FileList) => TReturn;


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
  add(file: FileInfo): File;

  /**
   * Determines whether the specified file exists in the list.
   *
   * @param file - The path or `File` object to check for
   * @pram compareProperty - The property of each file in the list to compare against. Defaults to the `path` property.
   */
  has(file: string | File, compareField?: FilePathField): boolean;

  /**
   * Returns the specified file in the list, or `undefined` if not found.
   *
   * @param file - The path or `File` object to get
   * @pram compareProperty - The property of each file in the list to compare against. Defaults to the `path` property.
   */
  get(file: string | File, compareField?: FilePathField): File | undefined;

  /**
   * Returns the specified file in the list. Throws an error if not found.
   *
   * @param file - The path or `File` object to get
   * @pram compareProperty - The property of each file in the list to compare against. Defaults to the `path` property.
   */
  demand(file: string | File, compareField?: FilePathField): File;

  /**
   * Removes the specified file from the list.
   *
   * @param file - The path or `File` object to delete
   * @pram compareProperty - The property of each file in the list to compare against. Defaults to the `path` property.
   * @returns `true` if the file was deleted from the list, or `false` if the file was not in the list.
   */
  delete(file: string | File, compareField?: FilePathField): boolean;

  /**
   * Removes all matching files from the list.
   *
   * @param predicate - A function that returns a truthy value for files to be removed
   * @param thisArg - The `this` context of the `predicate` function
   * @returns - A list containing only the removed files
   */
  delete<T = void>(predicate: FileIterator<T>): FileList;

  /**
   * Removes all files from the list.
   */
  clear(): void;

  /**
   * Returns a string consisting of all the elements of the list, separated by the specified separator.
   */
  join(separator?: string): string;

  /**
   * Returns a file in the list where predicate is true, or `undefined` otherwise.
   */
  // tslint:disable-next-line: max-line-length
  find<F extends File, T = void>(predicate: (this: T, file: File, files: FileList) => file is F, thisArg?: T): F | undefined;

  /**
   * Returns a file in the list where predicate is true, or `undefined` otherwise.
   */
  find<T = void>(predicate: FileIterator<T>, thisArg?: T): File | undefined;

  /**
   * Determines whether every file in the list satisfies the specified test.
   */
  every<T = void>(predicate: FileIterator<T>, thisArg?: T): boolean;

  /**
   * Determines whether any file in the list satisfies the specified test.
   */
  some<T = void>(predicate: FileIterator<T>, thisArg?: T): boolean;

  /**
   * Performs the specified action for each file in the list.
   */
  forEach<T = void>(iterator: FileIterator<T>, thisArg?: T): void;

  /**
   * Maps each file in the list to value, and returns the array of values.
   */
  map<U, T = void>(mapper: FileIterator<T, U>, thisArg?: T): U[];

  /**
   * Returns the files that satisfy the specified test.
   */
  filter<T = void>(predicate: FileIterator<T>, thisArg?: T): FileList;

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
}
