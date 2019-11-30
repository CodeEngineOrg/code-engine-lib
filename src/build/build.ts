import { BuildContext, BuildSummary, ChangedFile, File } from "@code-engine/types";
import { createChangedFile, drainIterable, IterableWriter } from "@code-engine/utils";
import { BuildStep } from "../plugins/types";
import { runBuildStep } from "./build-step";

/**
 * Runs files through a series of plugins.
 * @internal
 */
export async function runBuild(files: AsyncIterable<File>, steps: BuildStep[], concurrency: number, context: BuildContext): Promise<BuildSummary> {
  let promises: Array<Promise<void>> = [], promise: Promise<void>;

  let summary: BuildSummary = {
    input: { fileCount: 0, fileSize: 0 },
    output: { fileCount: 0, fileSize: 0 },
    time: { start: new Date(), end: new Date(), elapsed: 0 },
  };

  // Remove the contents from the changed files so the build context is lightweight
  // for cloning across the thread boundary
  context.changedFiles = context.changedFiles.map(lightweightChangedFile);

  // Collect metrics on the input files
  let input = updateBuildSummary(summary, "input", files);

  // Chain the build steps together, with each one accepting the output of the previous one as input
  for (let step of steps) {
    let output = new IterableWriter<File>();
    promise = runBuildStep(step, concurrency, input, output, context);
    promises.push(promise);
    input = output.iterable;
  }

  // Collect metrics on the final output files
  let finalOutput = updateBuildSummary(summary, "output", input);

  // Wait for all build steps to finish
  promises.push(drainIterable(finalOutput, concurrency));
  await Promise.all(promises);

  // Update the build summary
  summary.time.end = new Date();
  summary.time.elapsed = summary.time.end.getTime() - summary.time.start.getTime();

  return summary;
}


/**
 * Creates a "lightweight" copy of a `ChangedFile` object without its contents.
 */
function lightweightChangedFile(changedFile: ChangedFile): ChangedFile {
  let copy = createChangedFile({ ...changedFile });
  copy.contents = Buffer.alloc(0);
  return copy;
}


/**
 * Updates the `input` or `output` metrics of the given `BuildSummary`.
 */
function updateBuildSummary(summary: BuildSummary, io: "input" | "output", files: AsyncIterable<File>)
: AsyncIterable<File> {
  return {
    [Symbol.asyncIterator]() {
      let iterator = files[Symbol.asyncIterator]();

      return {
        async next() {
          let result = await iterator.next();
          if (!result.done) {
            summary[io].fileCount++;
            summary[io].fileSize += result.value.size;
          }
          return result;
        }
      };
    },
  };
}
