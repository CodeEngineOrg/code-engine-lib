import { BuildContext, BuildSummary, ChangedFile, Context, EventName, File, FileChange } from "@code-engine/types";
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
  public async watch(): Promise<void> {
    return;
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
      context = { ...context, ...summary };
      context.changedFiles = context.changedFiles.slice();
      this.emit(EventName.BuildFinished, context);
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
}
