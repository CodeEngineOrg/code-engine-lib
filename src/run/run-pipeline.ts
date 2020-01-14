import { ChangedFile, File, Run, Summary } from "@code-engine/types";
import { createChangedFile, drainIterable, IterableWriter } from "@code-engine/utils";
import { FileProcessorPlugin } from "../plugins/types";
import { runStep } from "./run-step";

/**
 * Runs files through a series of plugins.
 * @internal
 */
export async function runPipeline(files: AsyncIterable<File>, steps: FileProcessorPlugin[], run: Run): Promise<Summary> {
  let promises: Array<Promise<void>> = [], promise: Promise<void>;

  // Remove the contents from the changed files so the Run is lightweight
  // for cloning across the thread boundary
  // @ts-ignore
  run.changedFiles = run.changedFiles.map(lightweightChangedFile);

  let summary: Summary = {
    ...run,
    input: { fileCount: 0, fileSize: 0 },
    output: { fileCount: 0, fileSize: 0 },
    time: { start: new Date(), end: new Date(), elapsed: 0 },
  };

  // Collect metrics on the input files
  let input = updateSummary(summary, "input", files);

  // Chain the steps together, with each one accepting the output of the previous one as input
  for (let step of steps) {
    let output = new IterableWriter<File>();
    promise = runStep(step, input, output, run);
    promises.push(promise);
    input = output.iterable;
  }

  // Collect metrics on the final output files
  let finalOutput = updateSummary(summary, "output", input);

  // Wait for all steps to finish
  promises.push(drainIterable(finalOutput, run.concurrency));
  await Promise.all(promises);

  // Update the summary
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
 * Updates the `input` or `output` metrics of the given `Summary`.
 */
function updateSummary(summary: Summary, io: "input" | "output", files: AsyncIterable<File>)
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
