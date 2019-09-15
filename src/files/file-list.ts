// tslint:disable: completed-docs
import { ono } from "ono";
import { CodeEngineFile } from "./file";
import { File, FileInfo, FileList, FilePathField } from "./types";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * The internal CodeEngine implementation of the `FileList` interface.
 */
export class CodeEngineFileList implements FileList {
  private readonly [_internal]: {
    files: File[];
  };

  public constructor(files: File[] = []) {
    Object.defineProperty(this, _internal, { value: { files }});
  }

  public get size(): number {
    return this[_internal].files.length;
  }

  public [Symbol.iterator](): Iterator<File> {
    return this[_internal].files.values();
  }

  public *keys(): Iterator<string> {
    for (let file of this) {
      yield file.path;
    }
  }

  public values(): Iterator<File> {
    return this[_internal].files.values();
  }

  public *entries(): Iterator<[string, File]> {
    for (let file of this) {
      yield [file.path, file];
    }
  }

  public add(props: FileInfo): File {
    if (this.has(props.path)) {
      throw ono({ path: props.path }, `Duplicate file path: ${props.path}`);
    }

    let file = new CodeEngineFile(props);
    this[_internal].files.push(file);
    return file;
  }

  public has(file: string | File, compareField?: FilePathField): boolean {
    let index = findIndex(this, file, compareField);
    return index >= 0;
  }

  public get(file: string | File, compareField?: FilePathField): File | undefined {
    let index = findIndex(this, file, compareField);
    return index === -1 ? undefined : this[_internal].files[index];
  }

  public demand(file: string | File, compareField?: FilePathField): File {
    let index = findIndex(this, file, compareField);
    if (index === -1) {
      throw ono({ path: typeof file === "string" ? file : file.path }, `Could not find file: ${file}`);
    }
    return this[_internal].files[index];
  }

  public delete(file: string | File, compareField?: FilePathField): boolean {
    let index = findIndex(this, file, compareField);

    if (index === -1) {
      return false;
    }

    this[_internal].files.splice(index, 1);
    return true;
  }

  public clear(): void {
    this[_internal].files = [];
  }

  public join(separator?: string): string {
    return this[_internal].files.join(separator);
  }

  public find<T = void>(predicate: (this: T, file: File, files: FileList) => unknown, thisArg?: T): File | undefined {
    return this[_internal].files.find((file) => predicate.call(thisArg, file, this));
  }

  public every<T = void>(predicate: (this: T, file: File, files: FileList) => unknown, thisArg?: T): boolean {
    return this[_internal].files.every((file) => predicate.call(thisArg, file, this));
  }

  public some<T = void>(predicate: (this: T, file: File, files: FileList) => unknown, thisArg?: T): boolean {
    return this[_internal].files.some((file) => predicate.call(thisArg, file, this));
  }

  public forEach<T = void>(iterator: (this: T, file: File, files: FileList) => void, thisArg?: T): void {
    this[_internal].files.forEach((file) => iterator.call(thisArg, file, this));
  }

  public map<U, T = void>(mapper: (this: T, file: File, files: FileList) => U, thisArg?: T): U[] {
    return this[_internal].files.map((file) => mapper.call(thisArg, file, this));
  }

  public filter<T = void>(predicate: (this: T, file: File, files: FileList) => unknown, thisArg?: T): FileList {
    let files = this[_internal].files.filter((file) => predicate.call(thisArg, file, this));
    return new CodeEngineFileList(files);
  }

  public reduce<U>(reducer: (accumulator: U, file: File, files: FileList) => U, initialValue?: U): U {
    return this[_internal].files.reduce((accumulator, file) => reducer(accumulator, file, this), initialValue as U);
  }

  /**
   * Returns a string representation of the file list.
   */
  public toString(): string {
    return `${this.size} files`;
  }

  /**
   * Returns the name to use for `Object.toString()`.
   */
  public get [Symbol.toStringTag](): string {
    return "FileList";
  }
}

/**
 * Returns the internal index of the specified file.
 */
function findIndex(list: CodeEngineFileList, file: string | File, compareField: FilePathField = "path") {
  let searchValue = typeof file === "string" ? file : file[compareField];

  let i = 0, files = list[_internal].files;
  for (; i < files.length; i++) {
    if (files[i][compareField] === searchValue) {
      return i;
    }
  }

  return -1;
}
