import { ono } from "ono";
import { FileInfo, FileList } from "../files/types";
import { CodeEnginePlugin } from "../plugins/plugin";
import { Context } from "../plugins/types";
import { FileSource, isFileSource } from "../type-guards";
import { InitialBuildPhase, SubsequentBuildPhase } from "./build-phases";
import { iterateMultiple } from "./iterate-multiple";

/**
 * Runs files through a series of plugins as efficiently as possible.
 */
export class BuildPipeline {
  private _sources: FileSource[];
  private _initialPhase: InitialBuildPhase;
  private _subsequentPhases: SubsequentBuildPhase[];

  public constructor(plugins: CodeEnginePlugin[]) {
    this._sources = plugins.filter(isFileSource);

    // Split the plugin list into separate build phases, based on which plugins are capable of
    // running in parallal, and which ones must be run sequentially.
    let [index, initialPhase] = InitialBuildPhase.create(plugins);
    this._initialPhase = initialPhase;
    this._subsequentPhases = SubsequentBuildPhase.create(plugins.slice(index));
  }

  /**
   * Runs the given files through the build pipeline.
   */
  public async run(context: Context): Promise<FileList> {
    // Iterate through each source file, processing each file in parallel for maximum performance.
    for await (let [source, fileInfo] of find(this._sources, context)) {
      this._initialPhase.processFile(source, fileInfo, context);
    }

    // Wait for all the initial build phases to finish
    let files = await this._initialPhase.finished();

    // The remaining build phases (if any) process the full list of files
    for (let phase of this._subsequentPhases) {
      await phase.processFiles(files, context);
    }

    return files;
  }
}

/**
 * Calls the `find()` method of all file source plugins, and returns an iterator of all the files.
 */
function find(sources: FileSource[], context: Context): AsyncIterableIterator<[FileSource, FileInfo]> {
  if (sources.length === 0) {
    throw ono("At least one file source is required.");
  }

  return iterateMultiple(sources, (source) => source.find(context));
}
