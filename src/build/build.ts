import { Context, File } from "@code-engine/types";
import { drainIterable, IterableWriter, joinIterables } from "@code-engine/utils";
import { PluginController } from "../plugins/plugin-controller";
import { BuildStep, FileSource, isBuildStep, isFileSource } from "../plugins/types";
import { runBuildStep } from "./build-step";
import { BuildSummary, updateBuildSummary } from "./build-summary";

/**
 * Runs files through a series of plugins.
 * @internal
 */
export class Build {
  private _sources: FileSource[];
  private _steps: BuildStep[];

  public summary: BuildSummary = {
    input: { fileCount: 0, fileSize: 0 },
    output: { fileCount: 0, fileSize: 0 },
    time: { start: new Date(), end: new Date(), elapsed: 0 },
  };

  /**
   * Separates the plugins by type and order.
   */
  public constructor(plugins: PluginController[]) {
    this._sources = plugins.filter(isFileSource);
    this._steps = plugins.filter(isBuildStep);
  }

  /**
   * Runs the given files through the build pipeline.
   */
  public async run(concurrency: number, context: Context): Promise<void> {
    let promises: Array<Promise<void>> = [], promise: Promise<void>;

    // Read files from all sources simultaneously
    let files = this._readAll(context);

    // Collect metrics on the input files
    let input = updateBuildSummary(this.summary, "input", files);

    // Chain the build steps together, with each one accepting the output of the previous one as input
    for (let step of this._steps) {
      let output = new IterableWriter<File>();
      promise = runBuildStep(step, concurrency, input, output, context);
      promises.push(promise);
      input = output.iterable;
    }

    // Collect metrics on the final output files
    let finalOutput = updateBuildSummary(this.summary, "output", input);

    // Wait for all build steps to finish
    promises.push(drainIterable(finalOutput));
    await Promise.all(promises);

    // Update the build summary
    this.summary.time.end = new Date();
    this.summary.time.elapsed = this.summary.time.end.getTime() - this.summary.time.start.getTime();
  }

  /**
   * Reads all source files simultaneously from all file sources.
   */
  private _readAll(context: Context): AsyncIterable<File> {
    let fileGenerators = this._sources.map((source) => source.read(context));
    return joinIterables(...fileGenerators);
  }
}
