import { BuildContext, BuildSummary, CodeEngineEventEmitter, Context, EventName, File, FileChange } from "@code-engine/types";
import { iterate, joinIterables } from "@code-engine/utils";
import { PluginController } from "../plugins/plugin-controller";
import { hasClean, hasDispose, isBuildStep, isFileSource } from "../plugins/types";
import { runBuild } from "./build";
import { watchAllSources } from "./watch";

/**
 * A sequence of CodeEngine plugins that can be used to run builds.
 * @internal
 */
export class BuildPipeline {
  private _plugins: PluginController[] = [];
  private _events: CodeEngineEventEmitter;

  public constructor(emitter: CodeEngineEventEmitter) {
    this._events = emitter;
  }

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
  public async build(context: Context): Promise<BuildSummary> {
    let buildContext: BuildContext = {
      ...context,
      fullBuild: true,
      partialBuild: false,
      changedFiles: [],
    };

    this._emitBuildStarting(buildContext);

    let files = readAllSources(this._plugins, buildContext);
    let steps = this._plugins.filter(isBuildStep);
    let summary = await runBuild(files, steps, buildContext);

    this._emitBuildFinished(summary);
    return summary;
  }

  /**
   * Watches source files for changes and runs incremental re-builds whenever changes are detected.
   */
  public watch(delay: number, context: Context): void {
    let steps = this._plugins.filter(isBuildStep);

    Promise.resolve()
      .then(async () => {
        for await (let changedFiles of watchAllSources(this._plugins, delay, context)) {
          let buildContext: BuildContext = {
            ...context,
            fullBuild: false,
            partialBuild: true,
            changedFiles,
          };

          this._emitBuildStarting(buildContext);

          // Only build the files that still exist (i.e. not the ones that were deleted)
          let files = changedFiles.filter((file) => file.change !== FileChange.Deleted);
          let summary = await runBuild(iterate(files), steps, buildContext);

          this._emitBuildFinished(summary);
        }
      })
      .catch((error: Error) => {
        this._events.emit(EventName.Error, error, context);
      });
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
    if (this._events.listenerCount(EventName.BuildStarting) > 0) {
      // Clone the BuildContext to prevent listeners from mutating it and affecting the build
      context = {
        ...context,
        changedFiles: [
          ...context.changedFiles
        ]
      };

      this._events.emit(EventName.BuildStarting, context);
    }
  }

  /**
   * Emits a "buildFinished" event
   */
  private _emitBuildFinished(summary: BuildSummary): void {
    if (this._events.listenerCount(EventName.BuildFinished) > 0) {
      this._events.emit(EventName.BuildFinished, summary);
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
