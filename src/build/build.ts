import { Context, File } from "@code-engine/types";
import { IterableWriter, joinIterables } from "@code-engine/utils";
import { PluginController } from "../plugins/plugin-controller";
import { BuildStep, FileSource, isBuildStep, isFileSource } from "../plugins/types";
import { runBuildStep } from "./build-step";
import { BuildSummary } from "./build-summary";

/**
 * Runs files through a series of plugins.
 * @internal
 */
export class Build {
  private _sources: FileSource[];
  private _steps: BuildStep[];

  public summary: BuildSummary = {
    fileCount: 0,
    totalFileSize: 0,
    elapsedTime: 0,
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
    let startTime = Date.now();
    let promises: Array<Promise<void>> = [], promise: Promise<void>;

    // Read files from all sources simultaneously
    let files = this._readAll(context);

    // Chain the build steps together, with each one accepting the output of the previous one as input
    for (let step of this._steps) {
      let output = new IterableWriter<File>();
      promise = runBuildStep(step, concurrency, files, output, context);
      promises.push(promise);
      files = output.iterable;
    }

    // Collect metrics on the final output files
    promise = this._updateSummary(files);
    promises.push(promise);

    // Wait for all build steps to finish
    await Promise.all(promises);
    this.summary.elapsedTime = Date.now() - startTime;
  }

  /**
   * Reads all source files simultaneously from all file sources.
   */
  private _readAll(context: Context): AsyncIterable<File> {
    let fileGenerators = this._sources.map((source) => source.read(context));
    return joinIterables(...fileGenerators);
  }

  // tslint:disable-next-line: no-async-without-await
  private async _updateSummary(files: AsyncIterable<File>): Promise<void> {
    for await (let file of files) {
      this.summary.fileCount++;
      this.summary.totalFileSize += file.size;
    }
  }
}
