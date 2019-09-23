// tslint:disable: max-classes-per-file
import { CodeEngineFile } from "../files/file";
import { CodeEngineFileList } from "../files/file-list";
import { File, FileInfo, FileList } from "../files/types";
import { CodeEnginePlugin } from "../plugins/plugin";
import { Context } from "../plugins/types";
import { FileSource, hasProcessFile, HasProcessFile, hasProcessFiles } from "../type-guards";

/**
 * The initial build phase, during which each file is processed in parallel for maximum performance.
 */
export class InitialBuildPhase {
  public readonly plugins: HasProcessFile[] = [];
  private readonly _promises: Array<Promise<File[]>> = [];

  private constructor() {}

  /**
   * Creates the initial build phase, which consists of all the parallel plugins, up to the first sequential plugin.
   */
  public static create(plugins: CodeEnginePlugin[]): [number, InitialBuildPhase] {
    let initialPhase = new InitialBuildPhase();
    let index = 0;

    for (; index < plugins.length; index++) {
      let plugin = plugins[index];

      if (hasProcessFile(plugin)) {
        initialPhase.plugins.push(plugin);
      }

      if (hasProcessFiles(plugin)) {
        // We found the first sequential plugin, which ends the initial build phase
        break;
      }
    }

    return [index, initialPhase];
  }


  /**
   * Reads and processes a file asynchronously. The asnc operation is tracked internally rather than
   * returning a Promise.
   */
  public processFile(source: FileSource, fileInfo: FileInfo, context: Context): void {
    let promise = Promise.resolve();
    let file = new CodeEngineFile(fileInfo);

    if (source.read && (fileInfo.contents === undefined || fileInfo.contents === null)) {
      // We need to call `Plugin.read()` to get the file contents, before processing it.
      promise = promise.then(() => source.read!(file, context));
    }

    let filesPromise = promise.then(() => processFile(file, this.plugins, context));
    this._promises.push(filesPromise);
  }


  /**
   * Waits for all of the `processFile()` operations to finish.
   */
  public async finished(): Promise<FileList> {
    let fileLists = await Promise.all(this._promises);
    return new CodeEngineFileList().concat(...fileLists);
  }
}


/**
 * A subsequent build phase, which occurs after at least one sequential plugin, which means that
 * we now have the complete list of files. Nonetheless, we can achieve perfomance gains by processing
 * the file list in parallel.
 */
export class SubsequentBuildPhase {
  public readonly plugins: HasProcessFile[] = [];

  private constructor() {}

  /**
   * Creates the subsequent build phases, each of which may consist of a single sequential plugin,
   * or multiple parallel plugins.
   */
  public static create(plugins: CodeEnginePlugin[]): SubsequentBuildPhase[] {
    let buildPhases: SubsequentBuildPhase[] = [];
    let buildPhase: SubsequentBuildPhase | undefined;

    for (let [index, plugin] of plugins.entries()) {
      if (hasProcessFile(plugin) && index > 0) {
        // Group all parallel plugins together into one build phase
        buildPhase || (buildPhase = new SubsequentBuildPhase());
        buildPhase.plugins.push(plugin);
      }

      if (hasProcessFiles(plugin)) {
        // Add all the parallel plugins that have been grouped together so far
        if (buildPhase) {
          buildPhases.push(buildPhase);
          buildPhase = undefined;
        }

        // Add the plugin directly, since it already implements `processFiles()`
        buildPhases.push(plugin as unknown as SubsequentBuildPhase);
      }
    }

    // Add the final build phase, if any
    if (buildPhase) {
      buildPhases.push(buildPhase);
    }

    return buildPhases;
  }


  /**
   * Process the list of files in parallel.
   */
  public async processFiles(files: FileList, context: Context): Promise<void> {
    await Promise.all(files.map((file) => processFile(file, this.plugins, context)));
  }
}


/**
 * Process the given file through all the specified plugins.
 */
async function processFile(file: File, plugins: HasProcessFile[], context: Context): Promise<File[]> {
  // Get the first plugin
  let plugin = plugins[0];
  plugins = plugins.slice(1);

  if (!plugin) {
    // There are no plugins, so just return the file as-is
    return [file];
  }

  // Process the file through the first plugin.
  // The plugin may return zero, one, or multiple output files.
  let outputFiles = await plugin.processFile(file, context);

  // Process all output files simultaneously through the rest of the plugins
  let files = await Promise.all(outputFiles.map(async (file2) => processFile(file2, plugins, context)));

  return files.flat();
}
