import { CodeEngineFile } from "./file";
import { FileClone, SerializedFile } from "./file-clone";
import { CodeEngineFileList } from "./file-list";
import { FileList } from "./types";

/**
 * A clone of a `FileList`. The clone exists in a worker thread and mirrors a `FileList` that
 * exists on the main thread.
 */
export class FileListClone extends CodeEngineFileList {
  public constructor(serialized: SerializedFileList) {
    let files = serialized.map((file) => new FileClone(file));
    super(files);
  }

  /**
   * Serializes the given `FileList` so it can be passed across the thread boundary.
   */
  public static serialize(files: FileList): SerializedFileList {
    return files.map((file) => FileClone.serialize(file));
  }

  /**
   * Updates the given `FileList` object to match the specified serialized data.
   */
  public static update(files: FileList, serialized: SerializedFileList): FileList {
    let oldFiles = new CodeEngineFileList([...files]);

    // Clear the list, and then only add the files that are in the serialized list
    files.clear();

    for (let serializedFile of serialized) {
      let originalFile = oldFiles.get(serializedFile.originalPath, "originalPath");

      if (originalFile) {
        // This file was in the original list, so update it and copy it to the new list
        FileClone.update(originalFile, serializedFile);
        files.add(originalFile);
      }
      else {
        // This is a new file
        files.add(new CodeEngineFile(serializedFile));
      }
    }

    return files;
  }
}


/**
 * The data that is sent across the thread boundary between a `CodeEngineWorker` and an `Executor`
 * to represent a `FileList`.
 */
export type SerializedFileList = SerializedFile[];
