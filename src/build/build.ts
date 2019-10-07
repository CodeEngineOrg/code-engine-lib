import { Context, File } from "@code-engine/types";
import { iterableSeries, joinIterables } from "@code-engine/utils";
import { CodeEnginePlugin } from "../plugins/plugin";
import { BuildStep, FileSource, isBuildStep, isFileSource } from "../plugins/types";
import { BuildSummary } from "./build-summary";

/**
 * Runs files through a series of plugins.
 * @internal
 */
export class Build {
  private _sources: FileSource[];
  private _steps: BuildStep[];

  /**
   * Separates the plugins by type and order.
   */
  public constructor(plugins: CodeEnginePlugin[]) {
    this._sources = plugins.filter(isFileSource);
    this._steps = plugins.filter(isBuildStep);
  }

  /**
   * Runs the given files through the build pipeline.
   */
  public async run(concurrency: number, context: Context): Promise<BuildSummary> {
    let startTime = Date.now();
    let files = this._readAll(context);
    let steps = this._steps.map((step) => step.processFiles.bind(step));
    let series = iterableSeries(files, steps, { concurrency, args: [context] });

    let fileCount = 0, totalFileSize = 0;

    for await (let file of series) {
      fileCount++;
      totalFileSize += file.size;
    }

    return {
      fileCount,
      totalFileSize,
      took: Date.now() - startTime,
    };
  }

  /**
   * Reads all source files simultaneously from all file sources.
   */
  private _readAll(context: Context): AsyncIterable<File> {
    let fileGenerators = this._sources.map((source) => source.read(context));
    return joinIterables(fileGenerators);
  }
}
