import { CodeEngineFile, CodeEngineFiles, FileInfo, FileList } from "../files";
import { isFileDestination, isFileSource, Plugin, PluginContext } from "../plugins";
import { createBuildPhases } from "./create-build-phases";
import { iterateMultiple } from "./iterate-multiple";

/**
 * Runs the given build pipeline
 */
export async function build(plugins: Plugin[], context: PluginContext): Promise<FileList> {
  let files = new CodeEngineFiles();

  // Split the build into phases,
  // based on which plugins are capable of running in parallel, versus sequential
  let [initialPhase, subsequentPhases] = createBuildPhases(plugins);

  // Iterate through each source file, processing each file in parallel for maximum performance.
  for await (let fileInfo of find(plugins, context)) {
    let file = new CodeEngineFile(fileInfo);
    files.add(file);
    initialPhase.processFile(file, context);
  }

  // Wait for all the initial build phases to finish
  await initialPhase.finished();

  // The remaining build phases (if any) process the full list of files
  for (let phase of subsequentPhases) {
    await phase.processAllFiles(files, context);
  }

  // Find all the destination plugins
  let destinations = plugins.filter(isFileDestination);

  // TODO: Write each file to the destinations, without waiting for all files to be processed

  return files;
}

/**
 * Calls the `find()` method of all file source plugins, and returns an iterator of all the files.
 */
function find(plugins: Plugin[], context: PluginContext): AsyncIterableIterator<FileInfo> {
  // Find all the file sources
  let sources = plugins.filter(isFileSource);

  if (sources.length === 0) {
    throw new Error("At least one file source is required.");
  }

  let iterators = sources.map((plugin) => plugin.find(context));
  return iterateMultiple(iterators);
}
