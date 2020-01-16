"use strict";

const { CodeEngine } = require("../../");
const { delay, getFiles, iterateAll } = require("../utils");
const { expect } = require("chai");
const sinon = require("sinon");

// CI environments are slow, so use a larger time buffer
const TIME_BUFFER = process.env.CI ? 300 : 75;
const WATCH_DELAY = process.env.CI ? 300 : 100;

describe("Plugin.watch()", () => {

  function createEvents (engine) {
    let events = {
      start: sinon.spy(),
      finish: sinon.spy(),
      change: sinon.spy(),
      error: sinon.spy(),
    };

    engine.on("error", events.error);
    engine.on("start", events.start);
    engine.on("finish", events.finish);
    engine.on("change", events.change);

    return events;
  }

  it("should do nothing if no plugins implement watch", async () => {
    let plugin1 = { clean () {} };
    let plugin2 = { read () {} };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.notCalled(events.start);
    sinon.assert.notCalled(events.finish);
    sinon.assert.notCalled(events.change);
  });

  it("should call the watch() method of all plugins", async () => {
    let plugin1 = {
      watch: sinon.spy(),
    };
    let plugin2 = {
      watch: sinon.spy(),
    };
    let plugin3 = {
      watch: sinon.spy(),
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2, plugin3);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.calledOnce(plugin1.watch);
    sinon.assert.calledOnce(plugin2.watch);
    sinon.assert.calledOnce(plugin3.watch);

    sinon.assert.notCalled(events.error);
    sinon.assert.notCalled(events.start);
    sinon.assert.notCalled(events.finish);
    sinon.assert.notCalled(events.change);
  });

  it("should be called with the plugin's `this` context", async () => {
    let plugin1 = {
      watch: sinon.spy(),
    };
    let plugin2 = {
      watch: sinon.spy(),
    };

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.calledOn(plugin1.watch, plugin1);
    sinon.assert.calledOn(plugin2.watch, plugin2);
  });

  it("should support iterable syntax", async () => {
    let plugin = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created" };
        yield { path: "file2.txt", change: "modified" };
        yield { path: "file3.txt", change: "deleted" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    for (let run of [preRun, postRun]) {
      expect(run.full).to.equal(false);
      expect(run.partial).to.equal(true);
      expect(run.changedFiles).to.have.lengthOf(3);
      expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(run.changedFiles[0]).to.have.property("change", "created");
      expect(run.changedFiles[1]).to.have.property("name", "file2.txt");
      expect(run.changedFiles[1]).to.have.property("change", "modified");
      expect(run.changedFiles[2]).to.have.property("name", "file3.txt");
      expect(run.changedFiles[2]).to.have.property("change", "deleted");
    }

    expect(postRun.input).to.deep.equal({ fileCount: 2, fileSize: 0 });
    expect(postRun.output).to.deep.equal({ fileCount: 2, fileSize: 0 });

    let files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "modified");
    expect(files[2]).to.have.property("name", "file3.txt");
    expect(files[2]).to.have.property("change", "deleted");
  });

  it("should support callback syntax", async () => {
    let plugin = {
      async watch (fileChanged) {
        await delay();
        fileChanged({ path: "file1.txt", change: "created" });
        fileChanged({ path: "file2.txt", change: "modified" });
        fileChanged({ path: "file3.txt", change: "deleted" });
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    for (let run of [preRun, postRun]) {
      expect(run.full).to.equal(false);
      expect(run.partial).to.equal(true);
      expect(run.changedFiles).to.have.lengthOf(3);
      expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(run.changedFiles[0]).to.have.property("change", "created");
      expect(run.changedFiles[1]).to.have.property("name", "file2.txt");
      expect(run.changedFiles[1]).to.have.property("change", "modified");
      expect(run.changedFiles[2]).to.have.property("name", "file3.txt");
      expect(run.changedFiles[2]).to.have.property("change", "deleted");
    }

    expect(postRun.input).to.deep.equal({ fileCount: 2, fileSize: 0 });
    expect(postRun.output).to.deep.equal({ fileCount: 2, fileSize: 0 });

    let files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "modified");
    expect(files[2]).to.have.property("name", "file3.txt");
    expect(files[2]).to.have.property("change", "deleted");
  });

  it("should support iterator syntax", async () => {
    let plugin = {
      watch () {
        let files = [
          { path: "file1.txt", change: "created" },
          { path: "file2.txt", change: "modified" },
          { path: "file3.txt", change: "deleted" },
        ];
        let i = -1;

        return {
          async next () {
            await delay();
            if (++i < files.length) {
              return { value: files[i] };
            }
            else {
              return { done: true };
            }
          }
        };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    for (let run of [preRun, postRun]) {
      expect(run.full).to.equal(false);
      expect(run.partial).to.equal(true);
      expect(run.changedFiles).to.have.lengthOf(3);
      expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(run.changedFiles[0]).to.have.property("change", "created");
      expect(run.changedFiles[1]).to.have.property("name", "file2.txt");
      expect(run.changedFiles[1]).to.have.property("change", "modified");
      expect(run.changedFiles[2]).to.have.property("name", "file3.txt");
      expect(run.changedFiles[2]).to.have.property("change", "deleted");
    }

    expect(postRun.input).to.deep.equal({ fileCount: 2, fileSize: 0 });
    expect(postRun.output).to.deep.equal({ fileCount: 2, fileSize: 0 });

    let files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "modified");
    expect(files[2]).to.have.property("name", "file3.txt");
    expect(files[2]).to.have.property("change", "deleted");
  });

  it("should support a mix of iterable and callback syntaxes", async () => {
    let plugin = {
      async* watch (fileChanged) {
        await delay();
        yield { path: "file1.txt", change: "created" };
        fileChanged({ path: "file2.txt", change: "modified" });
        yield { path: "file3.txt", change: "deleted" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    for (let run of [preRun, postRun]) {
      expect(run.full).to.equal(false);
      expect(run.partial).to.equal(true);
      expect(run.changedFiles).to.have.lengthOf(3);
      expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(run.changedFiles[0]).to.have.property("change", "created");
      expect(run.changedFiles[1]).to.have.property("name", "file2.txt");
      expect(run.changedFiles[1]).to.have.property("change", "modified");
      expect(run.changedFiles[2]).to.have.property("name", "file3.txt");
      expect(run.changedFiles[2]).to.have.property("change", "deleted");
    }

    expect(postRun.input).to.deep.equal({ fileCount: 2, fileSize: 0 });
    expect(postRun.output).to.deep.equal({ fileCount: 2, fileSize: 0 });

    let files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "modified");
    expect(files[2]).to.have.property("name", "file3.txt");
    expect(files[2]).to.have.property("change", "deleted");
  });

  it("should dedupe multiple changes to the same file", async () => {
    let plugin = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "modified" };
        yield { path: "file1.txt", change: "modified" };
        yield { path: "file1.txt", change: "modified" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    for (let run of [preRun, postRun]) {
      expect(run.full).to.equal(false);
      expect(run.partial).to.equal(true);
      expect(run.changedFiles).to.have.lengthOf(1);
      expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(run.changedFiles[0]).to.have.property("change", "modified");
    }

    expect(postRun.input).to.deep.equal({ fileCount: 1, fileSize: 0 });
    expect(postRun.output).to.deep.equal({ fileCount: 1, fileSize: 0 });

    let files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "modified");
    expect(files[1]).to.have.property("name", "file1.txt");
    expect(files[1]).to.have.property("change", "modified");
    expect(files[2]).to.have.property("name", "file1.txt");
    expect(files[2]).to.have.property("change", "modified");
  });

  it("should dedupe a file that deleted and re-created as a modification", async () => {
    let plugin = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "deleted", text: "Old contents" };
        yield { path: "file1.txt", change: "created", text: "New contents" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledTwice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    for (let run of [preRun, postRun]) {
      expect(run.full).to.equal(false);
      expect(run.partial).to.equal(true);
      expect(run.changedFiles).to.have.lengthOf(1);
      expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(run.changedFiles[0]).to.have.property("change", "modified");
      expect(preRun.changedFiles[0]).to.have.property("text", "New contents");
    }

    expect(postRun.input).to.deep.equal({ fileCount: 1, fileSize: 12 });
    expect(postRun.output).to.deep.equal({ fileCount: 1, fileSize: 12 });

    let files = getFiles(events.change);
    expect(files).to.have.lengthOf(2);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "deleted");
    expect(files[0]).to.have.property("text", "Old contents");
    expect(files[1]).to.have.property("name", "file1.txt");
    expect(files[1]).to.have.property("change", "created");
    expect(files[1]).to.have.property("text", "New contents");
  });

  it("should dedupe a file that created and then modified a creation", async () => {
    let plugin = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created" };
        yield { path: "file1.txt", change: "modified", text: "Contents added" };
        yield { path: "file1.txt", change: "modified", text: "Contents changed" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    for (let run of [preRun, postRun]) {
      expect(run.full).to.equal(false);
      expect(run.partial).to.equal(true);
      expect(run.changedFiles).to.have.lengthOf(1);
      expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(run.changedFiles[0]).to.have.property("change", "created");
      expect(preRun.changedFiles[0]).to.have.property("text", "Contents changed");
    }

    expect(postRun.input).to.deep.equal({ fileCount: 1, fileSize: 16 });
    expect(postRun.output).to.deep.equal({ fileCount: 1, fileSize: 16 });

    let files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[0]).to.have.property("text", "");
    expect(files[1]).to.have.property("name", "file1.txt");
    expect(files[1]).to.have.property("change", "modified");
    expect(files[1]).to.have.property("text", "Contents added");
    expect(files[2]).to.have.property("name", "file1.txt");
    expect(files[2]).to.have.property("change", "modified");
    expect(files[2]).to.have.property("text", "Contents changed");
  });

  it("should dedupe a file that modified and then deleted as a deletion", async () => {
    let plugin = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created" };
        yield { path: "file1.txt", change: "modified", text: "Contents changed" };
        yield { path: "file1.txt", change: "deleted" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    for (let run of [preRun, postRun]) {
      expect(run.full).to.equal(false);
      expect(run.partial).to.equal(true);
      expect(run.changedFiles).to.have.lengthOf(1);
      expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(run.changedFiles[0]).to.have.property("change", "deleted");
      expect(preRun.changedFiles[0]).to.have.property("text", "Contents changed");
    }

    expect(postRun.input).to.deep.equal({ fileCount: 0, fileSize: 0 });
    expect(postRun.output).to.deep.equal({ fileCount: 0, fileSize: 0 });

    let files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[0]).to.have.property("text", "");
    expect(files[1]).to.have.property("name", "file1.txt");
    expect(files[1]).to.have.property("change", "modified");
    expect(files[1]).to.have.property("text", "Contents changed");
    expect(files[2]).to.have.property("name", "file1.txt");
    expect(files[2]).to.have.property("change", "deleted");
  });

  it("should not include deleted files in the run", async () => {
    let plugin1 = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created" };
        yield { path: "file2.txt", change: "modified" };
        yield { path: "file3.txt", change: "deleted" };
      }
    };
    let plugin2 = sinon.stub().returnsArg(0);

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);
    sinon.assert.calledTwice(plugin2);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(2);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "modified");

    let [summary] = events.finish.firstCall.args;
    expect(summary.input.fileCount).to.equal(2);
    expect(summary.output.fileCount).to.equal(2);

    files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[0]).to.have.property("text", "");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "modified");
    expect(files[1]).to.have.property("text", "");
    expect(files[2]).to.have.property("name", "file3.txt");
    expect(files[2]).to.have.property("change", "deleted");
    expect(files[2]).to.have.property("text", "");
  });

  it("should run an empty run if all changes are deletions", async () => {
    let plugin1 = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "deleted" };
        yield { path: "file2.txt", change: "deleted" };
        yield { path: "file3.txt", change: "deleted" };
      }
    };
    let plugin2 = sinon.stub().returnsArg(0);
    let plugin3 = {
      processFiles: sinon.stub().returnsArg(0)
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2, plugin3);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);

    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [preRun] = events.start.firstCall.args;
    let [postRun] = events.finish.firstCall.args;

    expect(preRun.changedFiles).to.have.lengthOf(3);
    expect(preRun.changedFiles[0]).to.have.property("change", "deleted");
    expect(preRun.changedFiles[1]).to.have.property("change", "deleted");
    expect(preRun.changedFiles[2]).to.have.property("change", "deleted");

    expect(postRun.changedFiles).to.have.lengthOf(3);
    expect(postRun.changedFiles[0]).to.have.property("change", "deleted");
    expect(postRun.changedFiles[1]).to.have.property("change", "deleted");
    expect(postRun.changedFiles[2]).to.have.property("change", "deleted");
    expect(postRun.input.fileCount).to.equal(0);
    expect(postRun.input.fileSize).to.equal(0);
    expect(postRun.output.fileCount).to.equal(0);
    expect(postRun.output.fileSize).to.equal(0);

    // The processFile() plugin DOES NOT get called, since there are no files to process
    sinon.assert.notCalled(plugin2);

    // The processFiles() plugin DOES get called, with an empty file list and 3 changed files
    sinon.assert.calledOnce(plugin3.processFiles);
    let [files, run] = plugin3.processFiles.firstCall.args;
    expect(await iterateAll(files)).to.have.lengthOf(0);
    expect(run.changedFiles).to.have.lengthOf(3);
    expect(run.changedFiles[0]).to.have.property("change", "deleted");
    expect(run.changedFiles[1]).to.have.property("change", "deleted");
    expect(run.changedFiles[2]).to.have.property("change", "deleted");

    files = getFiles(events.change);
    expect(files).to.have.lengthOf(3);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "deleted");
    expect(files[0]).to.have.property("text", "");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "deleted");
    expect(files[1]).to.have.property("text", "");
    expect(files[2]).to.have.property("name", "file3.txt");
    expect(files[2]).to.have.property("change", "deleted");
    expect(files[2]).to.have.property("text", "");
  });

  it("should include changed file contents in the start event", async () => {
    let plugin = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created", text: "Hello, world!" };
        yield { path: "file2.txt", change: "modified", text: "Hello again, world!" };
        yield { path: "file3.txt", change: "deleted", text: "Goodbye, cruel world!" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [run] = events.start.firstCall.args;
    expect(run.changedFiles[0]).to.have.property("name", "file1.txt");
    expect(run.changedFiles[0]).to.have.property("text", "Hello, world!");
    expect(run.changedFiles[1]).to.have.property("name", "file2.txt");
    expect(run.changedFiles[1]).to.have.property("text", "Hello again, world!");
    expect(run.changedFiles[2]).to.have.property("name", "file3.txt");
    expect(run.changedFiles[2]).to.have.property("text", "Goodbye, cruel world!");
  });

  it("should NOT include changed file contents in the finish event", async () => {
    let plugin = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created", text: "Hello, world!" };
        yield { path: "file2.txt", change: "modified", text: "Hello again, world!" };
        yield { path: "file3.txt", change: "deleted", text: "Goodbye, cruel world!" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);

    let [summary] = events.finish.firstCall.args;
    expect(summary.changedFiles[0]).to.have.property("name", "file1.txt");
    expect(summary.changedFiles[0]).to.have.property("text", "");
    expect(summary.changedFiles[1]).to.have.property("name", "file2.txt");
    expect(summary.changedFiles[1]).to.have.property("text", "");
    expect(summary.changedFiles[2]).to.have.property("name", "file3.txt");
    expect(summary.changedFiles[2]).to.have.property("text", "");

    expect(summary.input).to.deep.equal({ fileCount: 2, fileSize: 32 });
    expect(summary.output).to.deep.equal({ fileCount: 2, fileSize: 32 });
  });

  it("should include changed file contents in the run", async () => {
    let plugin1 = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created", text: "Hello, world!" };
        yield { path: "file2.txt", change: "modified", text: "Hello again, world!" };
        yield { path: "file3.txt", change: "deleted", text: "Goodbye, cruel world!" };
      }
    };
    let plugin2 = sinon.stub().returnsArg(0);

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledThrice(events.change);
    sinon.assert.calledTwice(plugin2);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(2);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("text", "Hello, world!");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("text", "Hello again, world!");
  });

  it("should not include changes made in the start event in the run", async () => {
    let plugin1 = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created", text: "Hello, world!" };
        yield { path: "file2.txt", change: "modified", text: "Hello again, world!" };
      }
    };
    let plugin2 = sinon.stub().returnsArg(0);

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2);

    engine.on("start", ({ changedFiles }) => {
      changedFiles.push({ path: "file3.txt", change: "created", text: "Yo, world" });
    });

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.calledTwice(events.change);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(2);

    expect(files[0]).to.have.property("change", "created");
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("text", "Hello, world!");

    expect(files[1]).to.have.property("change", "modified");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("text", "Hello again, world!");

    let [summary] = events.finish.firstCall.args;
    expect(summary.input.fileCount).to.equal(2);
    expect(summary.output.fileCount).to.equal(2);
  });

  it("should do multiple runs", async () => {
    let plugin = {
      async* watch () {
        // 0ms
        yield { path: "file1.txt", change: "created" };
        yield { path: "file2.txt", change: "modified" };
        await delay(50);

        // 50ms
        yield { path: "file3.txt", change: "deleted" };
        await delay(300);

        // 350ms
        yield { path: "file4.txt", change: "created" };
        await delay(50);

        // 400ms
        yield { path: "file5.txt", change: "modified" };
        await delay(300);

        // 700ms
        yield { path: "file6.txt", change: "deleted" };
        await delay(300);

        // 1000ms
        yield { path: "file7.txt", change: "modified" };
        yield { path: "file8.txt", change: "modified" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(100);          // Use the same watch delay, even in CI

    // 100ms: A file was yielded at 50ms, so the run won't start until 150ms
    await delay(100);
    sinon.assert.notCalled(events.error);
    sinon.assert.notCalled(events.start);
    sinon.assert.notCalled(events.finish);
    sinon.assert.callCount(events.change, 3);

    // 200ms: A run occurred at 150ms
    await delay(100);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.callCount(events.change, 3);
    expect(events.start.firstCall.args[0].changedFiles).to.have.lengthOf(3);
    expect(events.finish.firstCall.args[0].changedFiles).to.have.lengthOf(3);

    // 450ms: A file was yielded at 350ms and another at 400ms, so the run won't start until 500ms
    await delay(250);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.start);
    sinon.assert.calledOnce(events.finish);
    sinon.assert.callCount(events.change, 5);

    // 600ms: A run occurred at 500ms
    await delay(200);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledTwice(events.start);
    sinon.assert.calledTwice(events.finish);
    sinon.assert.callCount(events.change, 5);
    expect(events.start.secondCall.args[0].changedFiles).to.have.lengthOf(2);
    expect(events.finish.secondCall.args[0].changedFiles).to.have.lengthOf(2);

    // 900ms: A run occurred at 700ms
    await delay(300);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledThrice(events.start);
    sinon.assert.calledThrice(events.finish);
    sinon.assert.callCount(events.change, 6);
    expect(events.start.thirdCall.args[0].changedFiles).to.have.lengthOf(1);
    expect(events.finish.thirdCall.args[0].changedFiles).to.have.lengthOf(1);

    // 1100ms: A run occurred at 1100ms
    await delay(200);
    sinon.assert.notCalled(events.error);
    sinon.assert.callCount(events.start, 4);
    sinon.assert.callCount(events.finish, 4);
    sinon.assert.callCount(events.change, 8);
    expect(events.start.getCalls()[3].args[0].changedFiles).to.have.lengthOf(2);
    expect(events.finish.getCalls()[3].args[0].changedFiles).to.have.lengthOf(2);
  });

  it("should emit an error if an invalid file is yielded", async () => {
    let plugin = {
      async* watch () {
        await delay();
        yield { path: "file1.txt" };
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.calledOnce(events.error);
    sinon.assert.notCalled(events.start);
    sinon.assert.notCalled(events.finish);
    sinon.assert.notCalled(events.change);

    let [error] = events.error.firstCall.args;

    expect(error).to.be.an.instanceOf(Error);
    expect(error.message).to.equal(
      "An error occurred in Plugin 1 while watching source files for changes. \n" +
      'The type of file change must be specified ("created", "modified", or "deleted").'
    );
  });

  it("should emit synchronous errors", async () => {
    let plugin = {
      name: "Synchronous Error Test",
      watch () {
        throw new SyntaxError("Boom!");
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.calledOnce(events.error);
    sinon.assert.notCalled(events.start);
    sinon.assert.notCalled(events.finish);
    sinon.assert.notCalled(events.change);

    let [error] = events.error.firstCall.args;

    expect(error).to.be.an.instanceOf(SyntaxError);
    expect(error.message).to.equal("An error occurred in Synchronous Error Test while watching source files for changes. \nBoom!");
  });

  it("should emit asynchronous errors", async () => {
    let plugin = {
      name: "Asynchronous Error Test",
      // eslint-disable-next-line require-yield
      async* watch () {
        await delay();
        throw new URIError("Boom!");
      }
    };

    let engine = new CodeEngine();
    let events = createEvents(engine);
    await engine.use(plugin);

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.calledOnce(events.error);
    sinon.assert.notCalled(events.start);
    sinon.assert.notCalled(events.finish);
    sinon.assert.notCalled(events.change);

    let [error] = events.error.firstCall.args;

    expect(error).to.be.an.instanceOf(URIError);
    expect(error.message).to.equal("An error occurred in Asynchronous Error Test while watching source files for changes. \nBoom!");
  });

});
