import { CodeEngine } from "../code-engine";
import { FileList } from "../files/types";
import { CodeEnginePluginContext } from "../plugins/context";
import { CodeEnginePlugin } from "../plugins/plugin";
import { hasClean, hasStopWatching, isFileDestination } from "../type-guards";
import { BuildPipeline } from "./build-pipeline";

/**
 * Manages CodeEngine builds
 */
export class Build {
  public plugins: CodeEnginePlugin[] = [];
  private _engine: CodeEngine;

  public constructor(engine: CodeEngine) {
    this._engine = engine;
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(): Promise<void> {
    let cleaners = this.plugins.filter(hasClean);
    let context = new CodeEnginePluginContext(this._engine);
    await Promise.all(cleaners.map((cleaner) => cleaner.clean(context)));
  }

  /**
   * Runs a full build of all source files.
   *
   * @returns - The output files
   */
  public async build(): Promise<FileList> {
    let pipeline = new BuildPipeline(this.plugins);
    let context = new CodeEnginePluginContext(this._engine);
    let files = await pipeline.run(context);

    // Find all the destination plugins
    let destinations = this.plugins.filter(isFileDestination);

    // TODO: Write each file to the destinations, without waiting for all files to be processed

    return files;
  }

  /**
   * Runs a full build of all source files, and runs incremental re-builds whenever
   * source files change.
   */
  public async watch(): Promise<void> {
    return;
  }

  /**
   * Removes all plugins and stops watching source files.
   */
  public async dispose(): Promise<void> {
    let plugins = this.plugins;
    this.plugins = [];

    let watchers = plugins.filter(hasStopWatching);
    let context = new CodeEnginePluginContext(this._engine);
    await Promise.all(watchers.map((watcher) => watcher.stopWatching(context)));
  }
}
