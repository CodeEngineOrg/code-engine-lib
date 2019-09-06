// tslint:disable: max-classes-per-file
import { File, FileList } from "../files";
import { ParallelProcessor, PluginContext } from "../plugins";


/**
 * The initial build phase, during which each file is processed in parallel for maximum performance.
 */
export class InitialBuildPhase {
  public readonly plugins: ParallelProcessor[] = [];
  private readonly _promises: Array<Promise<void>> = [];

  /**
   * Processes a file asynchronously, but tracks the Promise internally rather than returning it.
   */
  public processFile(file: File, context: PluginContext): void {
    let promise = processFile(this.plugins, file, context);
    this._promises.push(promise);
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
  public readonly plugins: ParallelProcessor[] = [];

  /**
   * Process the list of files in parallel.
   */
  public async processAllFiles(files: FileList, context: PluginContext): Promise<void> {
    await Promise.all(files.map((file) => processFile(this.plugins, file, context)));
  }
}


/**
 * Process the given file through all the specified plugins.
 */
async function processFile(plugins: ParallelProcessor[], file: File, context: PluginContext): Promise<void> {
  for (let plugin of plugins) {
    await plugin.processFile(file, context);
  }
}
