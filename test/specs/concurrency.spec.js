"use strict";

const CodeEngine = require("../../");
const { getFiles, testThreadConsistency } = require("../utils");
const { expect } = require("chai");
const sinon = require("sinon");
const ono = require("ono");

// CI environments are slow, so use a larger time buffer
const TIME_BUFFER = process.env.CI ? 300 : 100;

describe("Concurrent processing", () => {
  testThreadConsistency((createModule) => {

    async function runConcurrentPlugins (plugins) {
      // This file source yields 10 files with no delay (i.e. as fast as the plugins can read them)
      let source = {
        name: "File Source",
        *read () {
          for (let i = 1; i <= 10; i++) {
            yield { path: `file${i}.txt`, text: "[]" };
          }
        },
      };

      // Creates a processFile() plugin that takes X milliseconds to process a file
      function factory ({ name, delay }) {
        return async (file) => {
          let array = JSON.parse(file.text);
          array.push({ file: file.name, plugin: name, timestamp: Date.now() });
          file.text = JSON.stringify(array);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return file;
        };
      }

      plugins = await Promise.all(plugins.map((plugin) => createModule(factory, plugin)));

      // Run CodeEngine using the file soure and plugins
      let spy = sinon.spy();
      let engine = new CodeEngine({ concurrency: 2 });
      await engine.use(source, ...plugins, spy);
      let startTime = Date.now();
      let summary = await engine.build();

      // Build a sorted log with the timestamps at which each file was processed
      let files = getFiles(spy);
      let log = []
        .concat(...files.map((file) => JSON.parse(file.text)))
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
        .map((entry) => {
          entry.timestamp -= startTime;
          return entry;
        });

      return { summary, log };
    }

    function assertLogEntries (log, expected) {
      expect(log).to.have.lengthOf(expected.length);

      for (let expectedEntry of expected) {
        let found = log.find((entry) => {
          return entry.plugin === expectedEntry.plugin &&
            entry.timestamp >= expectedEntry.timestamp &&
            entry.timestamp <= (expectedEntry.timestamp + TIME_BUFFER) &&
            (
              expectedEntry.file instanceof RegExp
                ? expectedEntry.file.test(entry.file)
                : expectedEntry.file === entry.file
            );
        });

        if (!found) {
          throw new Error(
            "No matching log entry was found.\n" +
            "\nEXPECTED:" + formatLog([expectedEntry]) +
            "\nLOG ENTRIES:" + formatLog(log)
          );
        }
      }
    }

    function errorHandler (error, log) {
      throw ono(error, "Incorrect call order.  Actual order was:" + formatLog(log));
    }

    function formatLog (log) {
      return "\n  " + log
        .map(({ file, plugin, timestamp }, index) => `${String(index).padStart(2)}: ${timestamp}ms ${plugin} ${file}`)
        .join("\n  ") + "\n";
    }

    it("should process one file in each plugin at the same time", async () => {
      let { summary, log } = await runConcurrentPlugins([
        { name: "Plugin1", delay: 100 },
        { name: "Plugin2", delay: 100 },
        { name: "Plugin3", delay: 100 },
      ]);

      try {
        // 0ms: Plugin1 starts processing the first two files
        assertLogEntries(log.slice(0, 2), [
          { timestamp: 0, plugin: "Plugin1", file: "file1.txt" },
          { timestamp: 0, plugin: "Plugin1", file: "file2.txt" },
        ]);

        // 100ms: Plugin2 starts processing the first two files, and Plugin1 starts processing the next two
        assertLogEntries(log.slice(2, 6), [
          { timestamp: 100, plugin: "Plugin2", file: "file1.txt" },
          { timestamp: 100, plugin: "Plugin2", file: "file2.txt" },
          { timestamp: 100, plugin: "Plugin1", file: "file3.txt" },
          { timestamp: 100, plugin: "Plugin1", file: "file4.txt" },
        ]);

        // 200ms: Plugin3 starts processing the first two files, and Plugin1 and Plugin2 start processing the next two
        assertLogEntries(log.slice(6, 12), [
          { timestamp: 200, plugin: "Plugin3", file: "file1.txt" },
          { timestamp: 200, plugin: "Plugin3", file: "file2.txt" },
          { timestamp: 200, plugin: "Plugin2", file: "file3.txt" },
          { timestamp: 200, plugin: "Plugin2", file: "file4.txt" },
          { timestamp: 200, plugin: "Plugin1", file: "file5.txt" },
          { timestamp: 200, plugin: "Plugin1", file: "file6.txt" },
        ]);

        // 300ms: The first 2 files are done
        assertLogEntries(log.slice(12, 18), [
          { timestamp: 300, plugin: "Plugin3", file: "file3.txt" },
          { timestamp: 300, plugin: "Plugin3", file: "file4.txt" },
          { timestamp: 300, plugin: "Plugin2", file: "file5.txt" },
          { timestamp: 300, plugin: "Plugin2", file: "file6.txt" },
          { timestamp: 300, plugin: "Plugin1", file: "file7.txt" },
          { timestamp: 300, plugin: "Plugin1", file: "file8.txt" },
        ]);

        // 400ms: The first 4 files are done
        assertLogEntries(log.slice(18, 24), [
          { timestamp: 400, plugin: "Plugin3", file: "file5.txt" },
          { timestamp: 400, plugin: "Plugin3", file: "file6.txt" },
          { timestamp: 400, plugin: "Plugin2", file: "file7.txt" },
          { timestamp: 400, plugin: "Plugin2", file: "file8.txt" },
          { timestamp: 400, plugin: "Plugin1", file: "file9.txt" },
          { timestamp: 400, plugin: "Plugin1", file: "file10.txt" },
        ]);

        // 500ms: The first 6 files are done. Plugin1 is finished.
        assertLogEntries(log.slice(24, 28), [
          { timestamp: 500, plugin: "Plugin3", file: "file7.txt" },
          { timestamp: 500, plugin: "Plugin3", file: "file8.txt" },
          { timestamp: 500, plugin: "Plugin2", file: "file9.txt" },
          { timestamp: 500, plugin: "Plugin2", file: "file10.txt" },
        ]);

        // 600ms: The first 8 files are done. Plugin1 and Plugin2 are finished.
        assertLogEntries(log.slice(28), [
          { timestamp: 600, plugin: "Plugin3", file: "file9.txt" },
          { timestamp: 600, plugin: "Plugin3", file: "file10.txt" },
        ]);

        // 700ms: All done
        expect(log).to.have.lengthOf(30);
        expect(summary.time.elapsed).to.be.at.least(700).and.at.most(700 + TIME_BUFFER);
      }
      catch (error) {
        errorHandler(error, log);
      }
    });

    it("should queue-up files in each plugin while waiting for the next plugin", async () => {
      let { summary, log } = await runConcurrentPlugins([
        { name: "Plugin1", delay: 0 },
        { name: "Plugin2", delay: 100 },
        { name: "Plugin3", delay: 200 },
      ]);

      try {
        // 0ms: Plugin1 processes files 1 & 2 and yields them to Plugin2.
        //      Plugin2 starts processing files 1 & 2.
        //      Plugin1 processes files 3 & 4 and yields them to Plugin2.
        //      Plugin2 queues-up the yielded files, but doesn't start processing them yet.
        //      Plugin1 processes files 5 & 6, since files 3 & 4 have been handed-off to Plugin2
        //      Plugin1 starts processing file 7 (this is an unintended side-effect of how joinIterables() works)
        assertLogEntries(log.slice(0, 9), [
          { timestamp: 0, plugin: "Plugin1", file: "file1.txt" },
          { timestamp: 0, plugin: "Plugin1", file: "file2.txt" },
          { timestamp: 0, plugin: "Plugin2", file: "file1.txt" },
          { timestamp: 0, plugin: "Plugin2", file: "file2.txt" },
          { timestamp: 0, plugin: "Plugin1", file: "file3.txt" },
          { timestamp: 0, plugin: "Plugin1", file: "file4.txt" },
          { timestamp: 0, plugin: "Plugin1", file: "file5.txt" },
          { timestamp: 0, plugin: "Plugin1", file: "file6.txt" },
          { timestamp: 0, plugin: "Plugin1", file: "file7.txt" },
        ]);

        // 100ms: Plugin2 has finished processing files 1 & 2 and yielded them to Plugin3.
        //        Plugin3 starts processing files 1 & 2.
        //        Plugin2 starts processing files 3 & 4. It queues-up files 5 & 6.
        //        Plugin1 is done processing file 7, but Plugin2 isn't ready for it yet (this is an unintended side-effect of how joinIterables() works)
        //        Plugin1 starts processing files 8 & 9.
        assertLogEntries(log.slice(9, 15), [
          { timestamp: 100, plugin: "Plugin3", file: "file1.txt" },
          { timestamp: 100, plugin: "Plugin3", file: "file2.txt" },
          { timestamp: 100, plugin: "Plugin2", file: "file3.txt" },
          { timestamp: 100, plugin: "Plugin2", file: "file4.txt" },
          { timestamp: 100, plugin: "Plugin1", file: "file8.txt" },
          { timestamp: 100, plugin: "Plugin1", file: "file9.txt" },
        ]);

        // 200ms: Plugin2 has finished processing files 3 & 4 and yielded them to Plugin3.
        //        Plugin3 is still processing files 1 & 2. It queues-up the yielded files.
        //        Plugin2 starts processing files 5 & 6. It queues-up files 7 & 8.
        //        Plugin1 has finished processing files 8 & 9, but Plugin2 isn't ready for them yet.
        //        Plugin1 starts processing file 10 (this is an uninteded side-effect how joinIterables() works).
        assertLogEntries(log.slice(15, 18), [
          { timestamp: 200, plugin: "Plugin2", file: "file5.txt" },
          { timestamp: 200, plugin: "Plugin2", file: /file[67].txt/ },
          { timestamp: 200, plugin: "Plugin1", file: "file10.txt" },
        ]);

        // 300ms: Plugin3 has finished processing files 1 & 2.
        //        Plugin3 starts processing files 3 & 4. It queues-up files 5 & 6.
        //        Plugin2 has finished processing files 5 & 6 and yielded them to Plugin3.
        //        Plugin2 starts processing files 7 & 8. It queues-up files 9 & 10.
        //        Plugin1 has finished processing file 10, but Plugin2 isn't ready for it yet.
        assertLogEntries(log.slice(18, 22), [
          { timestamp: 300, plugin: "Plugin3", file: "file3.txt" },
          { timestamp: 300, plugin: "Plugin3", file: "file4.txt" },
          { timestamp: 300, plugin: "Plugin2", file: /file[67].txt/ },
          { timestamp: 300, plugin: "Plugin2", file: /file[89].txt/ },
        ]);

        // 400ms: Plugin2 has finished processing files 7 & 8, but Plugin3 isn't ready for them yet.
        //        Plugin3 is still processing files 3 & 4 and already has files 5 & 6 queued-up.
        //        Plugin2 starts processing file 9 (this is an unintended side-effect of how joinIterables() works).
        //        Plugin1 is finished.
        assertLogEntries(log.slice(22, 23), [
          { timestamp: 400, plugin: "Plugin2", file: /file[89].txt/ },
        ]);

        // 500ms: Plugin3 has finished processing files 3 & 4.
        //        Plugin3 starts processing files 5 & 6. It queues=up files 7 & 8.
        //        Plugin2 starts processing file 10.
        assertLogEntries(log.slice(23, 26), [
          { timestamp: 500, plugin: "Plugin3", file: "file5.txt" },
          { timestamp: 500, plugin: "Plugin3", file: /file[67].txt/ },
          { timestamp: 500, plugin: "Plugin2", file: "file10.txt" },
        ]);

        // 700ms: Plugin3 has finished processing files 5 & 6.
        //        Plugin3 starts processing files 7 & 8. It queues-up files 9 & 10.
        //        Plugin2 is finished.
        assertLogEntries(log.slice(26, 28), [
          { timestamp: 700, plugin: "Plugin3", file: /file[67].txt/ },
          { timestamp: 700, plugin: "Plugin3", file: /file[89].txt/ },
        ]);

        // 900ms: Plugin3 has finished processing files 7 & 8.
        //        Plugin3 starts processing files 9 & 10.
        assertLogEntries(log.slice(28), [
          { timestamp: 900, plugin: "Plugin3", file: /file[89].txt/ },
          { timestamp: 900, plugin: "Plugin3", file: "file10.txt" },
        ]);

        // 1100ms: All done
        expect(log).to.have.lengthOf(30);
        expect(summary.time.elapsed).to.be.at.least(1100).and.at.most(1100 + TIME_BUFFER);
      }
      catch (error) {
        errorHandler(error, log);
      }
    });

    it("should wait until a file is accepted by the next plugin before processing another file", async () => {
      let { summary, log } = await runConcurrentPlugins([
        { name: "Plugin1", delay: 200 },
        { name: "Plugin2", delay: 100 },
        { name: "Plugin3", delay: 0 },
      ]);

      try {
        // 0ms: Plugin1 starts processing the first two files.
        assertLogEntries(log.slice(0, 2), [
          { timestamp: 0, plugin: "Plugin1", file: "file1.txt" },
          { timestamp: 0, plugin: "Plugin1", file: "file2.txt" },
        ]);

        // 200ms: Plugin1 has finished processing files 1 & 2 and yielded them to Plugin2.
        //        Plugin2 starts processing files 1 & 2.
        //        Plugin1 starts processing files 3 & 4.
        assertLogEntries(log.slice(2, 6), [
          { timestamp: 200, plugin: "Plugin2", file: "file1.txt" },
          { timestamp: 200, plugin: "Plugin2", file: "file2.txt" },
          { timestamp: 200, plugin: "Plugin1", file: "file3.txt" },
          { timestamp: 200, plugin: "Plugin1", file: "file4.txt" },
        ]);

        // 300ms: Plugin2 has finished processing files 1 & 2 and yielded them to Plugin3.
        //        Plugin3 processes files 1 & 2.
        //        Plugin2 is awaiting files, but none are available yet.
        //        Plugin1 i still processing files 3 & 4.
        assertLogEntries(log.slice(6, 8), [
          { timestamp: 300, plugin: "Plugin3", file: "file1.txt" },
          { timestamp: 300, plugin: "Plugin3", file: "file2.txt" },
        ]);

        // 400ms: Plugin1 has finished processing files 3 & 4 and yielded them to Plugin2.
        //        Plugin2 starts processing files 3 & 4.
        //        Plugin1 starts processing files 5 & 6.
        assertLogEntries(log.slice(8, 12), [
          { timestamp: 400, plugin: "Plugin2", file: "file3.txt" },
          { timestamp: 400, plugin: "Plugin2", file: "file4.txt" },
          { timestamp: 400, plugin: "Plugin1", file: "file5.txt" },
          { timestamp: 400, plugin: "Plugin1", file: "file6.txt" },
        ]);

        // 500ms: Plugin2 has finished processing files 3 & 4 and yielded them to Plugin3.
        //        Plugin3 processes files 3 & 4.
        //        Plugin2 is awaiting files, but none are available yet.
        //        Plugin1 i still processing files 5 & 6.
        assertLogEntries(log.slice(12, 14), [
          { timestamp: 500, plugin: "Plugin3", file: "file3.txt" },
          { timestamp: 500, plugin: "Plugin3", file: "file4.txt" },
        ]);

        // 600ms: Plugin1 has finished processing files 5 & 6 and yielded them to Plugin2.
        //        Plugin2 starts processing files 5 & 6.
        //        Plugin1 starts processing files 7 & 8.
        assertLogEntries(log.slice(14, 18), [
          { timestamp: 600, plugin: "Plugin2", file: "file5.txt" },
          { timestamp: 600, plugin: "Plugin2", file: "file6.txt" },
          { timestamp: 600, plugin: "Plugin1", file: "file7.txt" },
          { timestamp: 600, plugin: "Plugin1", file: "file8.txt" },
        ]);

        // 700ms: Plugin2 has finished processing files 5 & 6 and yielded them to Plugin3.
        //        Plugin3 processes files 5 & 6.
        //        Plugin2 is awaiting files, but none are available yet.
        //        Plugin1 i still processing files 7 & 8.
        assertLogEntries(log.slice(18, 20), [
          { timestamp: 700, plugin: "Plugin3", file: "file5.txt" },
          { timestamp: 700, plugin: "Plugin3", file: "file6.txt" },
        ]);

        // 800ms: Plugin1 has finished processing files 7 & 8 and yielded them to Plugin2.
        //        Plugin2 starts processing files 7 & 8.
        //        Plugin1 starts processing files 9 & 10.
        assertLogEntries(log.slice(20, 24), [
          { timestamp: 800, plugin: "Plugin2", file: "file7.txt" },
          { timestamp: 800, plugin: "Plugin2", file: "file8.txt" },
          { timestamp: 800, plugin: "Plugin1", file: "file9.txt" },
          { timestamp: 800, plugin: "Plugin1", file: "file10.txt" },
        ]);

        // 900ms: Plugin2 has finished processing files 7 & 8 and yielded them to Plugin3.
        //        Plugin3 processes files 7 & 8.
        //        Plugin2 is awaiting files, but none are available yet.
        //        Plugin1 i still processing files 9 & 10.
        assertLogEntries(log.slice(24, 26), [
          { timestamp: 900, plugin: "Plugin3", file: "file7.txt" },
          { timestamp: 900, plugin: "Plugin3", file: "file8.txt" },
        ]);

        // 1000ms: Plugin1 has finished processing files 9 & 10 and yielded them to Plugin2.
        //         Plugin2 starts processing files 9 & 10.
        //         Plugin1 is finished
        assertLogEntries(log.slice(26, 28), [
          { timestamp: 1000, plugin: "Plugin2", file: "file9.txt" },
          { timestamp: 1000, plugin: "Plugin2", file: "file10.txt" },
        ]);

        // 1100ms: Plugin2 has finished processing files 9 & 10 and yielded them to Plugin3.
        //         Plugin3 processes files 9 & 10.
        //         Plugin2 is finished.
        assertLogEntries(log.slice(28), [
          { timestamp: 1100, plugin: "Plugin3", file: "file9.txt" },
          { timestamp: 1100, plugin: "Plugin3", file: "file10.txt" },
        ]);

        // 1100ms: All done
        expect(log).to.have.lengthOf(30);
        expect(summary.time.elapsed).to.be.at.least(1100).and.at.most(1100 + TIME_BUFFER);
      }
      catch (error) {
        errorHandler(error, log);
      }
    });

  });
});
