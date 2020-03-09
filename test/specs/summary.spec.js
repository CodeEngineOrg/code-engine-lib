"use strict";

const { CodeEngine } = require("../../lib");
const { delay } = require("../utils");
const { host } = require("@jsdevtools/host-environment");
const { expect } = require("chai");
const sinon = require("sinon");

// CI environments are slow, so use a larger time buffer
const TIME_BUFFER = host.ci ? 200 : 50;

describe("Summary object", () => {

  function isValidSummary (summary) {
    expect(summary).to.be.an("object").with.keys(
      "cwd", "concurrency", "dev", "debug", "full", "partial", "changedFiles", "input", "output", "time", "log");
    expect(summary.cwd).to.be.a("string").with.length.above(0);
    expect(summary.concurrency).to.be.a("number").above(0);
    expect(summary.dev).to.be.a("boolean");
    expect(summary.debug).to.be.a("boolean");
    expect(summary.full).to.be.a("boolean");
    expect(summary.partial).to.be.a("boolean");
    expect(summary.changedFiles).to.be.an("array");
    expect(summary.input.fileCount).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.input.fileSize).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.output.fileCount).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.output.fileSize).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.time.start).to.be.an.instanceOf(Date);
    expect(summary.time.end).to.be.an.instanceOf(Date);
    expect(summary.time.end.getTime()).to.be.at.least(summary.time.start.getTime());
    expect(summary.time.elapsed).to.be.a("number").at.least(0).and.satisfies(Number.isInteger);
    expect(summary.log).to.be.a("function");
    expect(summary.log.info).to.be.a("function");
    expect(summary.log.debug).to.be.a("function");
    expect(summary.log.warn).to.be.a("function");
    expect(summary.log.error).to.be.a("function");
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 0, fileSize: 0 });
    expect(summary.output).to.deep.equal({ fileCount: 0, fileSize: 0 });
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 3, fileSize: 28 });
    expect(summary.output).to.deep.equal({ fileCount: 0, fileSize: 0 });
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 0, fileSize: 0 });
    expect(summary.output).to.deep.equal({ fileCount: 3, fileSize: 28 });
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 3, fileSize: 28 });
    expect(summary.output).to.deep.equal({ fileCount: 3, fileSize: 28 });
  });

  it("should have the same input and output data if no files were modified during the run", async () => {
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 3, fileSize: 28 });
    expect(summary.output).to.deep.equal({ fileCount: 3, fileSize: 28 });
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 3, fileSize: 28 });
    expect(summary.output).to.deep.equal({ fileCount: 3, fileSize: 58 });
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 3, fileSize: 28 });
    expect(summary.output).to.deep.equal({ fileCount: 6, fileSize: 89 });
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 3, fileSize: 28 });
    expect(summary.output).to.deep.equal({ fileCount: 3, fileSize: 43 });
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
    let onFinish = sinon.spy();
    engine.on("finish", onFinish);
    await engine.use(source, plugin);

    let summary = await engine.run();

    sinon.assert.calledOnce(onFinish);
    sinon.assert.calledWithExactly(onFinish, summary);

    expect(summary).to.satisfy(isValidSummary);
    expect(summary.input).to.deep.equal({ fileCount: 3, fileSize: 28 });
    expect(summary.output).to.deep.equal({ fileCount: 3, fileSize: 43 });
    expect(summary.time.elapsed).to.be.at.least(400).and.below(400 + TIME_BUFFER);
  });

});
