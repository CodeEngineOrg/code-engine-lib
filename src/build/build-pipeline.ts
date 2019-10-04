import { AsyncAllIterable, Context, File } from "@code-engine/types";
import { CodeEnginePlugin } from "../plugins/plugin";
import { hasClean, hasDispose, NormalizedPlugin } from "../plugins/types";
import { Build } from "./build";

/**
 * A sequence of CodeEngine plugins that can be used to run builds.
 * @internal
 */
export class BuildPipeline {
  private _plugins: CodeEnginePlugin[] = [];
  private _context: Context;

  public constructor(context: Context) {
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
  public add(plugin: NormalizedPlugin): void {
    this._plugins.push(new CodeEnginePlugin(plugin));
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
  public build(): AsyncAllIterable<File> {
    let build = new Build(this._plugins);
    return build.run(this._context);
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
