import { Context } from "@code-engine/types";
import { PluginController } from "../plugins/plugin-controller";
import { hasClean, hasDispose } from "../plugins/types";
import { Build } from "./build";
import { BuildSummary } from "./build-summary";

/**
 * A sequence of CodeEngine plugins that can be used to run builds.
 * @internal
 */
export class BuildPipeline {
  private _plugins: PluginController[] = [];
  private _concurrency: number;
  private _context: Context;

  public constructor(concurrency: number, context: Context) {
    this._concurrency = concurrency;
    this._context = context;
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
  public async clean(): Promise<void> {
    let cleaners = this._plugins.filter(hasClean);
    await Promise.all(cleaners.map((plugin) => plugin.clean(this._context)));
  }

  /**
   * Runs a full build of all source files.
   *
   * @returns - The output files
   */
  public async build(): Promise<BuildSummary> {
    let build = new Build(this._plugins);
    await build.run(this._concurrency, this._context);
    return build.summary;
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
  public async dispose(): Promise<void> {
    let plugins = this._plugins;
    this._plugins = [];

    let needDisposed = plugins.filter(hasDispose);
    await Promise.all(needDisposed.map((plugin) => plugin.dispose(this._context)));
  }
}
