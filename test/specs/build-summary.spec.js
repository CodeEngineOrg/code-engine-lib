"use strict";

const { CodeEngine } = require("../../");
const { delay } = require("../utils");
const { expect } = require("chai");

// CI environments are slow, so use a larger time buffer
const TIME_BUFFER = process.env.CI ? 200 : 50;

describe("BuildSummary object", () => {

  function isValidBuildSummary (summary) {
    expect(summary).to.be.an("object").with.keys("input", "output", "time");
    expect(summary.input.fileCount).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.input.fileSize).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.output.fileCount).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.output.fileSize).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.time.start).to.be.an.instanceOf(Date);
    expect(summary.time.end).to.be.an.instanceOf(Date);
    expect(summary.time.end.getTime()).to.be.at.least(summary.time.start.getTime());
    expect(summary.time.elapsed).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    return true;
  }

  it("should be all zeroes if no files are processed", async () => {
    let source = {
      read () {
        return [];
      }
    };
    let plugin = {
      processFile (file) {
        return file;
      }
    };

    let engine = new CodeEngine();
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 0,
        fileSize: 0,
      },
      output: {
        fileCount: 0,
        fileSize: 0,
      },
      time: summary.time,
    });
  });

  it("should have input data, even if there are no output files", async () => {
    let source = {
      *read () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt", text: "Hello, world!" };
        yield { path: "file3.txt", contents: Buffer.from("This is a test.") };
      }
    };
    let plugin = {
      processFile (file) {
        file.text += "12345";
      }
    };

    let engine = new CodeEngine();
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 3,
        fileSize: 28,
      },
      output: {
        fileCount: 0,
        fileSize: 0,
      },
      time: summary.time,
    });
  });

  it("should have output data, even if there are no input files", async () => {
    let source = {
      read () {
        return [];
      }
    };
    let plugin = {
      *processFiles () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt", text: "Hello, world!" };
        yield { path: "file3.txt", contents: Buffer.from("This is a test.") };
      }
    };

    let engine = new CodeEngine();
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 0,
        fileSize: 0,
      },
      output: {
        fileCount: 3,
        fileSize: 28,
      },
      time: summary.time,
    });
  });

  it("should have the same input and output data if no files match a plugin's filter criteria", async () => {
    let source = {
      *read () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt", text: "Hello, world!" };
        yield { path: "file3.txt", contents: Buffer.from("This is a test.") };
      }
    };
    let plugin = {
      filter: "*.html",
      processFile (file) {
        file.text += "12345";
        return file;
      }
    };

    let engine = new CodeEngine();
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 3,
        fileSize: 28,
      },
      output: {
        fileCount: 3,
        fileSize: 28,
      },
      time: summary.time,
    });
  });

  it("should have the same input and output data if no files were modified during the build", async () => {
    let source = {
      *read () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt", text: "Hello, world!" };
        yield { path: "file3.txt", contents: Buffer.from("This is a test.") };
      }
    };
    let plugin = {
      processFile (file) {
        return file;
      }
    };

    let engine = new CodeEngine();
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 3,
        fileSize: 28,
      },
      output: {
        fileCount: 3,
        fileSize: 28,
      },
      time: summary.time,
    });
  });

  it("should reflect the modified size of output files", async () => {
    let source = {
      *read () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt", text: "Hello, world!" };
        yield { path: "file3.txt", contents: Buffer.from("This is a test.") };
      }
    };
    let plugin = {
      processFile (file) {
        file.text += "1234567890";
        return file;
      }
    };

    let engine = new CodeEngine();
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 3,
        fileSize: 28,
      },
      output: {
        fileCount: 3,
        fileSize: 58,
      },
      time: summary.time,
    });
  });

  it("should reflect the modified count and size of output files", async () => {
    let source = {
      *read () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt", text: "Hello, world!" };
        yield { path: "file3.txt", contents: Buffer.from("This is a test.") };
      }
    };
    let plugin = {
      processFile (file) {
        switch (file.name) {
          case "file1.txt":
            file.text = "abc";
            return file;

          case "file2.txt":
            return [
              { ...file, path: "file2a.txt" },
              { ...file, path: "file2b.txt" },
            ];

          case "file3.txt":
            return [
              { path: "file3a.txt", text: file.text + "aaaaa" },
              { path: "file3b.txt", text: file.text + "bbbbb" },
              { path: "file3c.txt", text: file.text + "ccccc" },
            ];
        }
      }
    };

    let engine = new CodeEngine();
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 3,
        fileSize: 28,
      },
      output: {
        fileCount: 6,
        fileSize: 89,
      },
      time: summary.time,
    });
  });

  it("should have accurate time data for synchronous plugins", async () => {
    let source = {
      *read () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt", text: "Hello, world!" };
        yield { path: "file3.txt", contents: Buffer.from("This is a test.") };
      }
    };
    let plugin = {
      processFile (file) {
        file.text += "12345";
        return file;
      }
    };

    let engine = new CodeEngine();
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 3,
        fileSize: 28,
      },
      output: {
        fileCount: 3,
        fileSize: 43,
      },
      time: summary.time,
    });

    expect(summary.time.elapsed).to.be.at.least(0).and.below(TIME_BUFFER);
  });

  it("should have accurate time data for asynchronous plugins", async () => {
    let source = {
      async* read () {
        await delay(100);
        yield { path: "file1.txt" };
        await delay(100);
        yield { path: "file2.txt", text: "Hello, world!" };
        await delay(100);
        yield { path: "file3.txt", contents: Buffer.from("This is a test.") };
      }
    };
    let plugin = {
      async processFile (file) {
        await delay(100);
        file.text += "12345";
        return file;
      }
    };

    let engine = new CodeEngine({ concurrency: 1 });
    await engine.use(source, plugin);
    let summary = await engine.build();

    expect(summary).to.satisfy(isValidBuildSummary);
    expect(summary).to.deep.equal({
      input: {
        fileCount: 3,
        fileSize: 28,
      },
      output: {
        fileCount: 3,
        fileSize: 43,
      },
      time: summary.time,
    });

    expect(summary.time.elapsed).to.be.at.least(400).and.below(400 + TIME_BUFFER);
  });

});
