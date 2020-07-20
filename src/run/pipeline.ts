import { CodeEngine, EventName, File, FileChange, Run, Summary } from "@code-engine/types";
import { iterate, joinIterables } from "@code-engine/utils";
import { PluginController } from "../plugins/plugin-controller";
import { isCleanerPlugin, isDisposablePlugin, isFileProcessorPlugin, isFileSourcePlugin } from "../plugins/types";
import { runPipeline } from "./run-pipeline";
import { watchAllSources } from "./watch";

/**
 * A sequence of CodeEngine plugins that process files.
 * @internal
 */
export class Pipeline {
  private _plugins: PluginController[] = [];
  private _engine: CodeEngine;

  public constructor(engine: CodeEngine) {
    this._engine = engine;
  }

  /**
   * The number of plugins in the pipeline.
   */
  public get size(): number {
    return this._plugins.length;
  }

  /**
   * Adds a plugin to the pipeline
   */
  public add(plugin: PluginController): void {
    this._plugins.push(plugin);
  }

  /**
   * Deletes the contents of the destination(s).
   */
  public async clean(): Promise<void> {
    let cleaners = this._plugins.filter(isCleanerPlugin);
    await Promise.all(cleaners.map((plugin) => plugin.clean()));
  }

  /**
   * Runs all source files through the plugin pipeline.
   */
  public async run(): Promise<Summary> {
    let run = createRun(this._engine, {
      full: true,
      partial: false,
      changedFiles: [],
    });

    this._emitStart(run);

    let files = readAllSources(this._plugins, run);
    let steps = this._plugins.filter(isFileProcessorPlugin);
    let summary = await runPipeline(files, steps, run);

    this._emitFinish(summary);
    return summary;
  }

  /**
   * Watches source files for changes and starts an incremental run whenever changes are detected.
   */
  public watch(delay: number): void {
    let steps = this._plugins.filter(isFileProcessorPlugin);

    Promise.resolve()
      .then(async() => {
        for await (let changedFiles of watchAllSources(this._plugins, this._engine, delay)) {
          let run = createRun(this._engine, {
            full: false,
            partial: true,
            changedFiles,
          });

          this._emitStart(run);

          // Only run the files that still exist (i.e. not the ones that were deleted)
          let files = changedFiles.filter((file) => file.change !== FileChange.Deleted);
          let summary = await runPipeline(iterate(files), steps, run);

          this._emitFinish(summary);
        }
      })
      .catch((error: Error) => {
        this._engine.emit(EventName.Error, error);
      });
  }

  /**
   * Removes all plugins and stops watching source files.
   */
  public async dispose(): Promise<void> {
    let plugins = this._plugins;
    this._plugins = [];

    let needDisposed = plugins.filter(isDisposablePlugin);
    await Promise.all(needDisposed.map((plugin) => plugin.dispose()));
  }

  /**
   * Emits a "start" event
   */
  private _emitStart(run: Run): void {
    if (this._engine.listenerCount(EventName.Start) > 0) {
      // Clone the Run to prevent listeners from mutating it and affecting the run
      run = {
        ...run,
        changedFiles: [
          ...run.changedFiles
        ]
      };

      this._engine.emit(EventName.Start, run);
    }
  }

  /**
   * Emits a "finish" event
   */
  private _emitFinish(summary: Summary): void {
    if (this._engine.listenerCount(EventName.Finish) > 0) {
      this._engine.emit(EventName.Finish, summary);
    }
  }
}

/**
 * Creates a new `Run` object with the specified properties.
 */
function createRun(engine: CodeEngine, props: Partial<Run>): Run {
  return {
    cwd: engine.cwd,
    concurrency: engine.concurrency,
    full: true,
    partial: false,
    debug: engine.debug,
    dev: engine.dev,
    changedFiles: [],
    log: engine.log,
    ...props,
  };
}

/**
 * Reads all source files simultaneously from all file sources.
 */
function readAllSources(plugins: PluginController[], run: Run): AsyncIterable<File> {
  let sources = plugins.filter(isFileSourcePlugin);
  let fileGenerators = sources.map((source) => source.read(run));
  return joinIterables(...fileGenerators);
}
