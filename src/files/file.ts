import { ono } from "ono";
import * as path from "path";
import { File, FileInfo, FileMetadata } from "./types";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * The internal CodeEngine implementation of the `File` interface.
 */
export class CodeEngineFile implements File {
  public metadata: FileMetadata = {};
  public dir!: string;
  public extension!: string;
  private readonly [_internal]: {
    baseName: string;
  };

  public constructor(props: FileInfo) {
    Object.defineProperty(this, _internal, { value: {
      baseName: "",
    }});

    this.path = props.path;
    Object.assign(this.metadata, props.metadata);
  }

  public get name(): string {
    return this[_internal].baseName + this.extension;
  }

  public set name(value: string) {
    this.extension = path.extname(value);
    this[_internal].baseName = value.slice(0, -(this.extension.length));
  }

  public get path(): string {
    // NOTE: This getter is called A LOT, so we use simple concatenation rather than
    // calling `path.join()` to improve performance
    return this.dir.length > 0 ? this.dir + path.sep + this.name : this.name;
  }

  /**
   * Changes the current directory and file name
   */
  public set path(value: string) {
    if (path.isAbsolute(value)) {
      throw ono({ path: value }, `Expected a relative path, but got an absolute path: ${value}`);
    }

    let { dir, base } = path.parse(path.normalize(value));
    this.dir = dir;
    this[_internal].name = base;
  }

  /**
   * Returns a string representation of the file.
   */
  public toString(): string {
    return this.path;
  }

  /**
   * Returns the name to use for `Object.toString()`.
   */
  public get [Symbol.toStringTag](): string {
    return "File";
  }
}
