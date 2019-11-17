import { BuildContext, File } from "@code-engine/types";
import { ConcurrentTasks, IterableWriter, iterateParallel } from "@code-engine/utils";
import { BuildStep } from "../plugins/types";

/**
 * Runs a single build step
 *
 * @param step - The build step (CodeEngine plugin) to run
 * @param concurrency - The number of files to process concurrently
 * @param input - An async iterable of input files from the previous build step
 * @param output - An async iterable writer that sends output files to the next build step
 * @param context - Contextual information about the current build
 * @internal
 */
export async function runBuildStep(
step: BuildStep, concurrency: number, input: AsyncIterable<File>, output: IterableWriter<File>, context: BuildContext)
: Promise<void> {
  let concurrentTasks = new ConcurrentTasks(concurrency);
  let processFilesIO = setupProcessFilesIO(step, output, context);

  for await (let file of iterateParallel(input, concurrency)) {
    await concurrentTasks.waitForAvailability();

    if (!step.filter(file, context)) {
      // This file doesn't match the plugin's filter criteria, so just forward it on
      let promise = output.write(file);
      concurrentTasks.add(promise);
    }
    else {
      if (step.processFile) {
        let promise = step.processFile(file, context, output);
        concurrentTasks.add(promise);
      }

      if (processFilesIO) {
        let promise = processFilesIO.input.write(file);
        concurrentTasks.add(promise);
      }
    }
  }

  await concurrentTasks.waitForAll();

  if (processFilesIO) {
    await processFilesIO.waitUntilFinished();
  }

  await output.end();
}

/**
 * If the build step has a `processFiles()` method, then this function creates the input and output iterables for it.
 */
function setupProcessFilesIO(step: BuildStep, output: IterableWriter<File>, context: BuildContext) {
  if (step.processFiles) {
    // Create the input/output iterables for the processFiles() method
    let processFilesInput = new IterableWriter<File>();
    let processFilesOutput = step.processFiles(processFilesInput.iterable, context)[Symbol.asyncIterator]();
    let finished = false;

    // Connect the processFiles() output to the build step's output
    output.onRead = pipeOutput;

    return {
      input: processFilesInput,
      waitUntilFinished,
    };

    /**
     * Pipes output from the `processFiles()` method to the next build step.
     */
    async function pipeOutput() {
      try {
        let result = await processFilesOutput.next();

        if (result.done) {
          finished = true;
        }
        else {
          await output.write(result.value);
        }
      }
      catch (error) {
        await output.throw(error as Error);
      }
    }

    /**
     * Waits for the `processFiles()` method to finish processing all input files.
     */
    async function waitUntilFinished() {
      // Let the processFiles() method know that all files have been received
      await processFilesInput.end();

      // Wait for it to finish processing any remaining files
      while (!finished) {
        await pipeOutput();
      }
    }
  }
}
