// tslint:disable: max-classes-per-file
import { ono } from "ono";
import { CodeEngineFile, File, FileInfo, FileList, isContents, setContents } from "../files";
import { FileProcessor, FileSource, PluginContext } from "../plugins";


/**
 * The initial build phase, during which each file is processed in parallel for maximum performance.
 */
export class InitialBuildPhase {
  public readonly plugins: FileProcessor[] = [];
  private readonly _promises: Array<Promise<void>> = [];

  /**
   * Reads and processes a file asynchronously. The asnc operation is tracked internally rather than
   * returning a Promise.
   */
  public processFile(source: FileSource, fileInfo: FileInfo, context: PluginContext): File {
    let promise = Promise.resolve();
    let file = new CodeEngineFile(fileInfo);

    if (!isContents(fileInfo.contents) && source.read) {
      // We need to call `Plugin.read()` to get the file contents, before processing it.
      promise = promise.then(() => readFile(source, file, context));
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
  public readonly plugins: FileProcessor[] = [];

  /**
   * Process the list of files in parallel.
   */
  public async processAllFiles(files: FileList, context: PluginContext): Promise<void> {
    await Promise.all(files.map((file) => processFile(this.plugins, file, context)));
  }
}


/**
 * Reads the file's contents from its source
 */
async function readFile(source: FileSource, file: File, context: PluginContext): Promise<void> {
  try {
    let contents = await source.read!(file, context);
    setContents(file, contents);
  }
  catch (error) {
    throw ono(error, { path: file.path }, `${source.name} threw an error while reading ${file}.`);
  }
}


/**
 * Process the given file through all the specified plugins.
 */
async function processFile(plugins: FileProcessor[], file: File, context: PluginContext): Promise<void> {
  for (let plugin of plugins) {
    try {
      await plugin.processFile(file, context);
    }
    catch (error) {
      throw ono(error, { path: file.path }, `${plugin.name} threw an error while processing ${file}.`);
    }
  }
}
