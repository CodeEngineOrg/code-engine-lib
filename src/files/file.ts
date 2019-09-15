import { ono } from "ono";
import * as path from "path";
import { File, FileInfo, FileMetadata } from "./types";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * The internal CodeEngine implementation of the `File` interface.
 */
export class CodeEngineFile implements File {
  public dir!: string;
  public extension!: string;
  public createdAt: Date;
  public modifiedAt: Date;
  public metadata: FileMetadata = {};
  public contents: Buffer;
  private readonly [_internal]: {
    baseName: string;
    originalPath: string;
  };

  public constructor(props: FileInfo, originalPath?: string) {
    Object.defineProperty(this, _internal, { value: {
      baseName: "",
      originalPath,
    }});

    this.path = props.path;
    this.createdAt = props.createdAt || new Date();
    this.modifiedAt = props.modifiedAt || new Date();
    Object.assign(this.metadata, props.metadata);

    try {
      if (props.contents === null || props.contents === undefined) {
        this.contents = Buffer.alloc(0);
      }
      else if (Buffer.isBuffer(props.contents)) {
        this.contents = props.contents;
      }
      else {
        this.contents = Buffer.from(props.contents as string);
      }
    }
    catch (error) {
      throw ono(error, { path: this.path }, `Error setting file contents for ${this}`);
    }
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

    value = path.normalize(value);
    let { dir, name, ext } = path.parse(value);
    this.dir = dir;
    this.extension = ext;
    this[_internal].baseName = name;
    this[_internal].originalPath = this[_internal].originalPath || value;
  }

  public get originalPath(): string {
    return this[_internal].originalPath;
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
