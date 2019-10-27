import { BuildContext, File } from "@code-engine/types";
import { ConcurrentTasks, IterableWriter } from "@code-engine/utils";
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
  let processFilesInput: IterableWriter<File> | undefined;

  if (step.processFiles) {
    processFilesInput = new IterableWriter();
    let processFilesOutput = step.processFiles(processFilesInput.iterable, context);
    output.writeFrom(processFilesOutput);
  }

  for await (let file of input) {
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

      if (processFilesInput) {
        let promise = processFilesInput.write(file);
        concurrentTasks.add(promise);
      }
    }
  }

  await concurrentTasks.waitForAll();

  if (processFilesInput) {
    await processFilesInput.end();
  }

  await output.end();
}
