import { AsyncAllGenerator, AsyncAllIterable, File } from "@code-engine/types";
import { iterateAll } from "@code-engine/utils";

/**
 * A summary of a full or incremental build.
 */
export interface BuildSummary {
  input: {
    /**
     * The number of source files that were read at the start of the build.
     */
    fileCount: number;

    /**
     * The total size, in bytes, of all input files.
     */
    fileSize: number;
  };

  output: {
    /**
     * The number of files that were output.
     */
    fileCount: number;

    /**
     * The total size, in bytes, of all output files.
     */
    fileSize: number;
  };

  time: {
    /**
     * The date/time that the build started.
     */
    start: Date;

    /**
     * The date/time that the build ended.
     */
    end: Date;

    /**
     * How long the build took, in milliseconds.
     */
    elapsed: number;
  };
}


/**
 * Updates the `input` or `output` metrics of the given `BuildSummary`.
 */
export function updateBuildSummary(summary: BuildSummary, io: "input" | "output", files: AsyncIterable<File>): AsyncAllIterable<File> {
  let generator = gatherFileMetrics(summary, io, files) as AsyncAllGenerator<File>;
  generator.all = iterateAll;
  return generator;
}

// tslint:disable-next-line: no-async-without-await
async function* gatherFileMetrics(summary: BuildSummary, io: "input" | "output", files: AsyncIterable<File>) {
  for await (let file of files) {
    summary[io].fileCount++;
    summary[io].fileSize += file.size;
    yield file;
  }
}
