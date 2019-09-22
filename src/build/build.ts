import { ono } from "ono";
import { CodeEngine } from "../code-engine";
import { FileInfo, FileList } from "../files/types";
import { CodeEnginePluginContext } from "../plugins/context";
import { CodeEnginePlugin } from "../plugins/plugin";
import { PluginContext } from "../plugins/types";
import { FileSource, hasClean, hasStopWatching, isFileDestination, isFileSource } from "../type-guards";
import { createBuildPhases } from "./create-build-phases";
import { iterateMultiple } from "./iterate-multiple";

/**
 * The CodeEngine build pipeline
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
    let context = new CodeEnginePluginContext(this._engine);

    // Split the build into phases,
    // based on which plugins are capable of running in parallel, versus sequential
    let [initialPhase, subsequentPhases] = createBuildPhases(this.plugins);

    // Iterate through each source file, processing each file in parallel for maximum performance.
    for await (let [source, fileInfo] of find(this.plugins, context)) {
      initialPhase.processFile(source, fileInfo, context);
    }

    // Wait for all the initial build phases to finish
    let files = await initialPhase.finished();

    // The remaining build phases (if any) process the full list of files
    for (let phase of subsequentPhases) {
      await phase.processFiles(files, context);
    }

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

/**
 * Calls the `find()` method of all file source plugins, and returns an iterator of all the files.
 */
function find(plugins: CodeEnginePlugin[], context: PluginContext): AsyncIterableIterator<[FileSource, FileInfo]> {
  // Find all the file sources
  let sources = plugins.filter(isFileSource);

  if (sources.length === 0) {
    throw ono("At least one file source is required.");
  }

  return iterateMultiple(sources, (source) => source.find(context));
}
