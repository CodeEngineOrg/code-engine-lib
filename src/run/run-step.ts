import { File, Run } from "@code-engine/types";
import { ConcurrentTasks, IterableWriter, iterateParallel } from "@code-engine/utils";
import { FileProcessorPlugin } from "../plugins/types";

/**
 * Runs a single step of the pipeline
 *
 * @param step - The CodeEngine plugin to run
 * @param input - An async iterable of input files from the previous step
 * @param output - An async iterable writer that sends output files to the next step
 * @param run - Information about the run
 * @internal
 */
export async function runStep(
  step: FileProcessorPlugin, input: AsyncIterable<File>, output: IterableWriter<File>, run: Run): Promise<void> {
  let concurrentTasks = new ConcurrentTasks(run.concurrency);
  let processFilesIO = setupProcessFilesIO(step, output, run);

  for await (let file of iterateParallel(input, run.concurrency)) {
    await concurrentTasks.waitForAvailability();

    if (!step.filter(file, run)) {
      // This file doesn't match the plugin's filter criteria, so just forward it on
      let promise = output.write(file);
      concurrentTasks.add(promise);
    }
    else {
      if (step.processFile) {
        let promise = step.processFile(file, run, output);
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
 * If the step has a `processFiles()` (plural) method, then this function creates the input and output iterables for it.
 */
function setupProcessFilesIO(step: FileProcessorPlugin, output: IterableWriter<File>, run: Run) {
  if (step.processFiles) {
    // Create the input/output iterables for the processFiles() method
    let processFilesInput = new IterableWriter<File>();
    let processFilesOutput = step.processFiles(processFilesInput.iterable, run)[Symbol.asyncIterator]();
    let finished = false;

    // Connect the processFiles() output to the step's output
    output.onRead = pipeOutput;

    return {
      input: processFilesInput,
      waitUntilFinished,
    };

    /**
     * Pipes output from the `processFiles()` method to the next step.
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
