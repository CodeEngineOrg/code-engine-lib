import { serialize } from "../workers/serialization";
import { CodeEngineFile } from "./file";
import { File, FileInfo, FileMetadata } from "./types";

/**
 * A clone of a `File` object. The clone exists in a worker thread and mirrors a `File` that
 * exists on the main thread.
 */
export class FileClone extends CodeEngineFile {
  public constructor(serialized: SerializedFile) {
    let info: FileInfo = {
      path: serialized.path,
      metadata: serialized.metadata,
      contents: Buffer.from(serialized.contents),
    };

    super(info, serialized.originalPath);
  }

  /**
   * Serializes the given `File` object so it can be passed across the thread boundary.
   */
  public static serialize(file: File): SerializedFile {
    return {
      path: file.path,
      originalPath: file.originalPath,
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

    Object.assign(file.metadata, serialized.metadata);
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
  originalPath: string;
  createdAt: Date;
  modifiedAt: Date;
  metadata: FileMetadata;
  contents: Uint8Array;
}
