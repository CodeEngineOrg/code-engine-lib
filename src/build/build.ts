import { AsyncAllIterable, Context, File } from "@code-engine/types";
import { iterateMultiple } from "@code-engine/utils";
import { CodeEnginePlugin } from "../plugins/plugin";
import { FileSource, isFileSource } from "../plugins/types";
import { InitialBuildPhase, SubsequentBuildPhase } from "./build-phases";

/**
 * Runs files through a series of plugins.
 * @internal
 */
export class Build {
  private _sources: FileSource[];
  private _initialPhase: InitialBuildPhase;
  private _subsequentPhases: SubsequentBuildPhase[];

  /**
   * Separates the plugins by type and order.
   */
  public constructor(plugins: CodeEnginePlugin[]) {
    // Get all the file source plugins
    this._sources = plugins.filter(isFileSource);

    // Split the file processor plugins into separate build phases, based on which plugins
    // are capable of running in parallal, and which ones must be run sequentially.
    let [index, initialPhase] = InitialBuildPhase.create(plugins);
    this._initialPhase = initialPhase;
    this._subsequentPhases = SubsequentBuildPhase.create(plugins.slice(index));
  }

  /**
   * Runs the given files through the build pipeline.
   */
  public async run(context: Context): AsyncAllIterable<File> {
    // Iterate through each source file, processing each file in parallel.
    for await (let file of this._readAll(context)) {
      this._initialPhase.processFile(file, context);
    }

    // Wait for all the initial build phases to finish
    let files = await this._initialPhase.finished();

    // The remaining build phases (if any) process the full list of files
    for (let phase of this._subsequentPhases) {
      await phase.processFiles(files, context);
    }

    return files;
  }

  /**
   * Reads all source files simultaneously from all file sources.
   */
  private _readAll(context: Context): AsyncIterable<File> {
    let fileGenerators = this._sources.map((source) => source.read(context));
    return iterateMultiple(fileGenerators);
  }
}
