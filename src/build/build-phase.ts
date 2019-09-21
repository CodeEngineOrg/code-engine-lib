// tslint:disable: max-classes-per-file
import { CodeEngineFile } from "../files/file";
import { File, FileInfo, FileList } from "../files/types";
import { PluginContext } from "../plugins/types";
import { FileSource, HasProcessFile } from "../type-guards";

/**
 * The initial build phase, during which each file is processed in parallel for maximum performance.
 */
export class InitialBuildPhase {
  public readonly plugins: HasProcessFile[] = [];
  private readonly _promises: Array<Promise<void>> = [];

  /**
   * Reads and processes a file asynchronously. The asnc operation is tracked internally rather than
   * returning a Promise.
   */
  public processFile(source: FileSource, fileInfo: FileInfo, context: PluginContext): File {
    let promise = Promise.resolve();
    let file = new CodeEngineFile(fileInfo);

    if (source.read && (fileInfo.contents === undefined || fileInfo.contents === null)) {
      // We need to call `Plugin.read()` to get the file contents, before processing it.
      promise = promise.then(() => source.read!(file, context));
    }

    promise = promise.then(() => processFile(this.plugins, file, context));
    this._promises.push(promise);
    return file;
  }

  /**
   * Waits for all of the `processFile()` operations to finish.
   */
  public async finished(): Promise<void> {
    await Promise.all(this._promises);
  }
}


/**
 * A subsequent build phase, which occurs after at least one sequential plugin, which means that
 * we now have the complete list of files. Nonetheless, we can achieve perfomance gains by processing
 * the file list in parallel.
 */
export class SubsequentBuildPhase {
  public readonly plugins: HasProcessFile[] = [];

  /**
   * Process the list of files in parallel.
   */
  public async processFiles(files: FileList, context: PluginContext): Promise<void> {
    await Promise.all(files.map((file) => processFile(this.plugins, file, context)));
  }
}


/**
 * Process the given file through all the specified plugins.
 */
async function processFile(plugins: HasProcessFile[], file: File, context: PluginContext): Promise<void> {
  for (let plugin of plugins) {
    await plugin.processFile(file, context);
  }
}
