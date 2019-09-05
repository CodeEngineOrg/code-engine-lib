import * as path from "path";
import { File, FileInfo } from "./types";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * The internal CodeEngine implementation of the `File` interface.
 */
export class CodeEngineFile implements File {
  public metadata: Record<string, unknown> = {};
  public dir!: string;
  private readonly [_internal]: {
    name: string;
  };

  public constructor(props: FileInfo) {
    Object.defineProperty(this, _internal, { value: {
      name: "",
    }});

    this.path = props.path;
    Object.assign(this.metadata, props.metadata);
  }

  public get name(): string {
    return this[_internal].name;
  }

  public set name(value: string) {
    this[_internal].name = value;
  }

  public get extension(): string {
    return path.extname(this[_internal].name);
  }

  /**
   * Changes the current file extension
   */
  public set extension(value: string) {
    let currentExtension = path.extname(this[_internal].name);
    let currentBaseName = path.basename(this[_internal].name, currentExtension);

    if (!value) {
      this[_internal].name = currentBaseName;
    }
    else if (value[0] === ".") {
      this[_internal].name = currentBaseName + value;
    }
    else {
      this[_internal].name = currentBaseName + "." + value;
    }
  }

  public get path(): string {
    // NOTE: This getter is called A LOT, so we use simple concatenation rather than
    // calling `path.join()` to improve performance
    let { name } = this[_internal];
    return this.dir.length > 0 ? this.dir + path.sep + name : name;
  }

  /**
   * Changes the current directory and file name
   */
  public set path(value: string) {
    if (path.isAbsolute(value)) {
      throw new Error(`Expected a relative path, but got an absolute path: ${value}`);
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
  public [Symbol.toStringTag]() {
    return "File";
  }
}
