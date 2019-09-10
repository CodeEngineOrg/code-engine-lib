import { serialize, update } from "../workers";
import { Messenger } from "../workers/messenger";
import { CodeEngineFile } from "./file";
import { File, FileMetadata } from "./types";

const _internal = Symbol("Internal CodeEngine Properties");

/**
 * A clone of a `File` object. The clone exists in a worker thread and proxies calls back to the
 * main thread when needed.
 */
export class FileClone extends CodeEngineFile {
  private readonly [_internal]!: {
    messenger: Messenger;
  };

  public constructor(serialized: SerializedFile, messenger: Messenger) {
    super(serialized);
    Object.defineProperty(this, _internal, { value: { messenger }});
  }

  /**
   * Serializes the given `File` object so it can be passed across the thread boundary.
   */
  public static serialize(file: File): SerializedFile {
    return {
      path: file.path,
      metadata: serialize(file.metadata) as FileMetadata,
    };
  }

  /**
   * Updates the given `File` object to match the specified serialized data.
   */
  public static update(file: File, serialized: SerializedFile): File {
    if (file.path !== serialized.path) {
      file.path = serialized.path;
    }

    update(file.metadata, serialized.metadata);
    return file;
  }
}


/**
 * The data that is sent across the thread boundary between a `CodeEngineWorker` and an `Executor`
 * to represent a `File` object.
 */
export interface SerializedFile {
  path: string;
  metadata: FileMetadata;
}
