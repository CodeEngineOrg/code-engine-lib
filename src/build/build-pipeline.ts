import { BuildContext, BuildFinishedEventData, BuildSummary, ChangedFile, Context, EventName, File, FileChange } from "@code-engine/types";
import { debounceIterable, iterate, joinIterables } from "@code-engine/utils";
import { EventEmitter } from "events";
import { PluginController } from "../plugins/plugin-controller";
import { hasClean, hasDispose, hasWatch, isBuildStep, isFileSource } from "../plugins/types";
import { runBuild } from "./build";

/**
 * A sequence of CodeEngine plugins that can be used to run builds.
 * @internal
 */
export class BuildPipeline extends EventEmitter {
  private _plugins: PluginController[] = [];

  /**
   * The number of plugins in the build pipeline.
   */
  public get size(): number {
    return this._plugins.length;
  }

  /**
   * Adds a plugin to the build pipeline
   */
  public add(plugin: PluginController): void {
    this._plugins.push(plugin);
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(context: Context): Promise<void> {
    let cleaners = this._plugins.filter(hasClean);
    await Promise.all(cleaners.map((plugin) => plugin.clean(context)));
  }

  /**
   * Runs a full build of all source files.
   */
  public async build(concurrency: number, context: Context): Promise<BuildSummary> {
    let buildContext: BuildContext = {
      ...context,
      fullBuild: true,
      partialBuild: false,
      changedFiles: [],
    };

    this._emitBuildStarting(buildContext);

    let files = readAllSources(this._plugins, buildContext);
    let steps = this._plugins.filter(isBuildStep);
    let summary = await runBuild(files, steps, concurrency, buildContext);

    this._emitBuildFinished(buildContext, summary);
    return summary;
  }

  /**
   * Watches source files for changes and runs incremental re-builds whenever changes are detected.
   */
  public watch(delay: number, concurrency: number, context: Context): void {
    let fileChanges = watchAllSources(this._plugins, context);
    let batchedFileChanges = debounceIterable(fileChanges, delay);
    let steps = this._plugins.filter(isBuildStep);

    Promise.resolve()
      .then(async () => {
        for await (let changedFiles of batchedFileChanges) {
          let buildContext: BuildContext = {
            ...context,
            fullBuild: false,
            partialBuild: true,
            changedFiles,
          };

          this._emitBuildStarting(buildContext);

          // Only build the files that still exist (i.e. not the ones that were deleted)
          let files = changedFiles.filter((file) => file.change !== FileChange.Deleted);
          let summary = await runBuild(iterate(files), steps, concurrency, buildContext);

          this._emitBuildFinished(buildContext, summary);
        }
      })
      .catch(this.emit.bind(this, EventName.Error));
  }

  /**
   * Removes all plugins and stops watching source files.
   */
  public async dispose(context: Context): Promise<void> {
    let plugins = this._plugins;
    this._plugins = [];

    let needDisposed = plugins.filter(hasDispose);
    await Promise.all(needDisposed.map((plugin) => plugin.dispose(context)));
  }

  /**
   * Emits a "buildStarting" event
   */
  private _emitBuildStarting(context: BuildContext): void {
    if (this.listenerCount(EventName.BuildStarting) > 0) {
      context = { ...context };
      context.changedFiles = context.changedFiles.slice();
      this.emit(EventName.BuildStarting, context);
    }
  }

  /**
   * Emits a "buildFinished" event
   */
  private _emitBuildFinished(context: BuildContext, summary: BuildSummary): void {
    if (this.listenerCount(EventName.BuildFinished) > 0) {
      let data: BuildFinishedEventData = { ...context, ...summary };
      data.changedFiles = context.changedFiles.slice();
      this.emit(EventName.BuildFinished, data);
    }
  }
}

/**
 * Reads all source files simultaneously from all file sources.
 */
function readAllSources(plugins: PluginController[], context: BuildContext): AsyncIterable<File> {
  let sources = plugins.filter(isFileSource);
  let fileGenerators = sources.map((source) => source.read(context));
  return joinIterables(...fileGenerators);
}

/**
 * Watches all source files for changes.
 */
function watchAllSources(plugins: PluginController[], context: Context): AsyncIterable<ChangedFile> {
  let watchers = plugins.filter(hasWatch);
  let fileGenerators = watchers.map((watcher) => watcher.watch(context));
  return joinIterables(...fileGenerators);
}
