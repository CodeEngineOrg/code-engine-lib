import { ono } from "ono";
import { FileInfo, FileList } from "../files/types";
import { CodeEnginePlugin } from "../plugins/plugin";
import { PluginContext } from "../plugins/types";
import { FileSource, isFileDestination, isFileSource } from "../type-guards";
import { createBuildPhases } from "./create-build-phases";
import { iterateMultiple } from "./iterate-multiple";

/**
 * Runs the given build pipeline
 */
export async function build(plugins: CodeEnginePlugin[], context: PluginContext): Promise<FileList> {
  // Split the build into phases,
  // based on which plugins are capable of running in parallel, versus sequential
  let [initialPhase, subsequentPhases] = createBuildPhases(plugins);

  // Iterate through each source file, processing each file in parallel for maximum performance.
  for await (let [source, fileInfo] of find(plugins, context)) {
    initialPhase.processFile(source, fileInfo, context);
  }

  // Wait for all the initial build phases to finish
  let files = await initialPhase.finished();

  // The remaining build phases (if any) process the full list of files
  for (let phase of subsequentPhases) {
    await phase.processFiles(files, context);
  }

  // Find all the destination plugins
  let destinations = plugins.filter(isFileDestination);

  // TODO: Write each file to the destinations, without waiting for all files to be processed

  return files;
}

/**
 * Calls the `find()` method of all file source plugins, and returns an iterator of all the files.
 */
function find(plugins: CodeEnginePlugin[], context: PluginContext): AsyncIterableIterator<[FileSource, FileInfo]> {
  // Find all the file sources
  let sources = plugins.filter(isFileSource);

  if (sources.length === 0) {
    throw ono("At least one file source is required.");
  }

  return iterateMultiple(sources, (source) => source.find(context));
}
