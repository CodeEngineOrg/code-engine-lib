import { RequestHandlerCallbacks, serialize, update } from "../workers";
import { CodeEngineFile } from "./file";
import { File, FileMetadata } from "./types";

/**
 * A clone of a `File` object. The clone exists in a worker thread and proxies calls back to the
 * main thread when needed.
 */
export class FileClone extends CodeEngineFile {
  public constructor(serialized: SerializedFile, callbacks: RequestHandlerCallbacks) {
    super({
      path: serialized.path,
      metadata: serialized.metadata,
      contents: Buffer.from(serialized.contents),
    });
  }

  /**
   * Serializes the given `File` object so it can be passed across the thread boundary.
   */
  public static serialize(file: File): SerializedFile {
    return {
      path: file.path,
      createdAt: file.createdAt,
      modifiedAt: file.modifiedAt,
      metadata: serialize(file.metadata) as FileMetadata,
      contents: file.contents,
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
    file.contents = Buffer.from(serialized.contents);
    return file;
  }
}


/**
 * The data that is sent across the thread boundary between a `CodeEngineWorker` and an `Executor`
 * to represent a `File` object.
 */
export interface SerializedFile {
  path: string;
  createdAt: Date;
  modifiedAt: Date;
  metadata: FileMetadata;
  contents: Uint8Array;
}
