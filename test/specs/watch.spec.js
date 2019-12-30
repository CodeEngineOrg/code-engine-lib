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
      buildStarting: sinon.spy(),
      buildFinished: sinon.spy(),
      fileChanged: sinon.spy(),
      error: sinon.spy(),
    };

    engine.on("error", events.error);
    engine.on("buildStarting", events.buildStarting);
    engine.on("buildFinished", events.buildFinished);
    engine.on("fileChanged", events.fileChanged);

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
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);
    sinon.assert.notCalled(events.fileChanged);
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
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);
    sinon.assert.notCalled(events.fileChanged);
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

  it("should start a new build with changed files", async () => {
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);

    let [preBuild] = events.buildStarting.firstCall.args;
    let [postBuild] = events.buildFinished.firstCall.args;

    for (let build of [preBuild, postBuild]) {
      expect(build.fullBuild).to.equal(false);
      expect(build.partialBuild).to.equal(true);
      expect(build.changedFiles).to.have.lengthOf(3);
      expect(build.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(build.changedFiles[0]).to.have.property("change", "created");
      expect(build.changedFiles[1]).to.have.property("name", "file2.txt");
      expect(build.changedFiles[1]).to.have.property("change", "modified");
      expect(build.changedFiles[2]).to.have.property("name", "file3.txt");
      expect(build.changedFiles[2]).to.have.property("change", "deleted");
    }

    expect(postBuild.input).to.deep.equal({ fileCount: 2, fileSize: 0 });
    expect(postBuild.output).to.deep.equal({ fileCount: 2, fileSize: 0 });

    let files = getFiles(events.fileChanged);
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);

    let [preBuild] = events.buildStarting.firstCall.args;
    let [postBuild] = events.buildFinished.firstCall.args;

    for (let build of [preBuild, postBuild]) {
      expect(build.fullBuild).to.equal(false);
      expect(build.partialBuild).to.equal(true);
      expect(build.changedFiles).to.have.lengthOf(1);
      expect(build.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(build.changedFiles[0]).to.have.property("change", "modified");
    }

    expect(postBuild.input).to.deep.equal({ fileCount: 1, fileSize: 0 });
    expect(postBuild.output).to.deep.equal({ fileCount: 1, fileSize: 0 });

    let files = getFiles(events.fileChanged);
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledTwice(events.fileChanged);

    let [preBuild] = events.buildStarting.firstCall.args;
    let [postBuild] = events.buildFinished.firstCall.args;

    for (let build of [preBuild, postBuild]) {
      expect(build.fullBuild).to.equal(false);
      expect(build.partialBuild).to.equal(true);
      expect(build.changedFiles).to.have.lengthOf(1);
      expect(build.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(build.changedFiles[0]).to.have.property("change", "modified");
      expect(preBuild.changedFiles[0]).to.have.property("text", "New contents");
    }

    expect(postBuild.input).to.deep.equal({ fileCount: 1, fileSize: 12 });
    expect(postBuild.output).to.deep.equal({ fileCount: 1, fileSize: 12 });

    let files = getFiles(events.fileChanged);
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);

    let [preBuild] = events.buildStarting.firstCall.args;
    let [postBuild] = events.buildFinished.firstCall.args;

    for (let build of [preBuild, postBuild]) {
      expect(build.fullBuild).to.equal(false);
      expect(build.partialBuild).to.equal(true);
      expect(build.changedFiles).to.have.lengthOf(1);
      expect(build.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(build.changedFiles[0]).to.have.property("change", "created");
      expect(preBuild.changedFiles[0]).to.have.property("text", "Contents changed");
    }

    expect(postBuild.input).to.deep.equal({ fileCount: 1, fileSize: 16 });
    expect(postBuild.output).to.deep.equal({ fileCount: 1, fileSize: 16 });

    let files = getFiles(events.fileChanged);
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);

    let [preBuild] = events.buildStarting.firstCall.args;
    let [postBuild] = events.buildFinished.firstCall.args;

    for (let build of [preBuild, postBuild]) {
      expect(build.fullBuild).to.equal(false);
      expect(build.partialBuild).to.equal(true);
      expect(build.changedFiles).to.have.lengthOf(1);
      expect(build.changedFiles[0]).to.have.property("name", "file1.txt");
      expect(build.changedFiles[0]).to.have.property("change", "deleted");
      expect(preBuild.changedFiles[0]).to.have.property("text", "Contents changed");
    }

    expect(postBuild.input).to.deep.equal({ fileCount: 0, fileSize: 0 });
    expect(postBuild.output).to.deep.equal({ fileCount: 0, fileSize: 0 });

    let files = getFiles(events.fileChanged);
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

  it("should not include deleted files in the build", async () => {
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);
    sinon.assert.calledTwice(plugin2);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(2);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "modified");

    let [summary] = events.buildFinished.firstCall.args;
    expect(summary.input.fileCount).to.equal(2);
    expect(summary.output.fileCount).to.equal(2);

    files = getFiles(events.fileChanged);
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

  it("should run an empty build if all changes are deletions", async () => {
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

    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);

    let [preBuild] = events.buildStarting.firstCall.args;
    let [postBuild] = events.buildFinished.firstCall.args;

    expect(preBuild.changedFiles).to.have.lengthOf(3);
    expect(preBuild.changedFiles[0]).to.have.property("change", "deleted");
    expect(preBuild.changedFiles[1]).to.have.property("change", "deleted");
    expect(preBuild.changedFiles[2]).to.have.property("change", "deleted");

    expect(postBuild.changedFiles).to.have.lengthOf(3);
    expect(postBuild.changedFiles[0]).to.have.property("change", "deleted");
    expect(postBuild.changedFiles[1]).to.have.property("change", "deleted");
    expect(postBuild.changedFiles[2]).to.have.property("change", "deleted");
    expect(postBuild.input.fileCount).to.equal(0);
    expect(postBuild.input.fileSize).to.equal(0);
    expect(postBuild.output.fileCount).to.equal(0);
    expect(postBuild.output.fileSize).to.equal(0);

    // The processFile() plugin DOES NOT get called, since there are no files to process
    sinon.assert.notCalled(plugin2);

    // The processFiles() plugin DOES get called, with an empty file list and 3 changed files
    sinon.assert.calledOnce(plugin3.processFiles);
    let [files, buildContext] = plugin3.processFiles.firstCall.args;
    expect(await iterateAll(files)).to.have.lengthOf(0);
    expect(buildContext.changedFiles).to.have.lengthOf(3);
    expect(buildContext.changedFiles[0]).to.have.property("change", "deleted");
    expect(buildContext.changedFiles[1]).to.have.property("change", "deleted");
    expect(buildContext.changedFiles[2]).to.have.property("change", "deleted");

    files = getFiles(events.fileChanged);
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

  it("should include changed file contents in the buildStarting event", async () => {
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);

    let [buildContext] = events.buildStarting.firstCall.args;
    expect(buildContext.changedFiles[0]).to.have.property("name", "file1.txt");
    expect(buildContext.changedFiles[0]).to.have.property("text", "Hello, world!");
    expect(buildContext.changedFiles[1]).to.have.property("name", "file2.txt");
    expect(buildContext.changedFiles[1]).to.have.property("text", "Hello again, world!");
    expect(buildContext.changedFiles[2]).to.have.property("name", "file3.txt");
    expect(buildContext.changedFiles[2]).to.have.property("text", "Goodbye, cruel world!");
  });

  it("should NOT include changed file contents in the buildFinished event", async () => {
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);

    let [summary] = events.buildFinished.firstCall.args;
    expect(summary.changedFiles[0]).to.have.property("name", "file1.txt");
    expect(summary.changedFiles[0]).to.have.property("text", "");
    expect(summary.changedFiles[1]).to.have.property("name", "file2.txt");
    expect(summary.changedFiles[1]).to.have.property("text", "");
    expect(summary.changedFiles[2]).to.have.property("name", "file3.txt");
    expect(summary.changedFiles[2]).to.have.property("text", "");

    expect(summary.input).to.deep.equal({ fileCount: 2, fileSize: 32 });
    expect(summary.output).to.deep.equal({ fileCount: 2, fileSize: 32 });
  });

  it("should include changed file contents in the build", async () => {
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
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(events.fileChanged);
    sinon.assert.calledTwice(plugin2);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(2);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("text", "Hello, world!");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("text", "Hello again, world!");
  });

  it("should not include changes made in the buildStarting event in the build", async () => {
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

    engine.on("buildStarting", ({ changedFiles }) => {
      changedFiles.push({ path: "file3.txt", change: "created", text: "Yo, world" });
    });

    engine.watch(WATCH_DELAY);
    await delay(WATCH_DELAY + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledTwice(events.fileChanged);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(2);

    expect(files[0]).to.have.property("change", "created");
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("text", "Hello, world!");

    expect(files[1]).to.have.property("change", "modified");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("text", "Hello again, world!");

    let [summary] = events.buildFinished.firstCall.args;
    expect(summary.input.fileCount).to.equal(2);
    expect(summary.output.fileCount).to.equal(2);
  });

  it("should do multiple builds", async () => {
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

    // 100ms: A file was yielded at 50ms, so the build won't start until 150ms
    await delay(100);
    sinon.assert.notCalled(events.error);
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);
    sinon.assert.callCount(events.fileChanged, 3);

    // 200ms: A build occurred at 150ms
    await delay(100);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.callCount(events.fileChanged, 3);
    expect(events.buildStarting.firstCall.args[0].changedFiles).to.have.lengthOf(3);
    expect(events.buildFinished.firstCall.args[0].changedFiles).to.have.lengthOf(3);

    // 450ms: A file was yielded at 350ms and another at 400ms, so the build won't start until 500ms
    await delay(250);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.callCount(events.fileChanged, 5);

    // 600ms: A build occurred at 500ms
    await delay(200);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledTwice(events.buildStarting);
    sinon.assert.calledTwice(events.buildFinished);
    sinon.assert.callCount(events.fileChanged, 5);
    expect(events.buildStarting.secondCall.args[0].changedFiles).to.have.lengthOf(2);
    expect(events.buildFinished.secondCall.args[0].changedFiles).to.have.lengthOf(2);

    // 900ms: A build occurred at 700ms
    await delay(300);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledThrice(events.buildStarting);
    sinon.assert.calledThrice(events.buildFinished);
    sinon.assert.callCount(events.fileChanged, 6);
    expect(events.buildStarting.thirdCall.args[0].changedFiles).to.have.lengthOf(1);
    expect(events.buildFinished.thirdCall.args[0].changedFiles).to.have.lengthOf(1);

    // 1100ms: A build occurred at 1100ms
    await delay(200);
    sinon.assert.notCalled(events.error);
    sinon.assert.callCount(events.buildStarting, 4);
    sinon.assert.callCount(events.buildFinished, 4);
    sinon.assert.callCount(events.fileChanged, 8);
    expect(events.buildStarting.getCalls()[3].args[0].changedFiles).to.have.lengthOf(2);
    expect(events.buildFinished.getCalls()[3].args[0].changedFiles).to.have.lengthOf(2);
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
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);
    sinon.assert.notCalled(events.fileChanged);

    let [error, context] = events.error.firstCall.args;

    expect(error).to.be.an.instanceOf(Error);
    expect(error.message).to.equal(
      "An error occurred in Plugin 1 while watching source files for changes. \n" +
      'The type of file change must be specified ("created", "modified", or "deleted").'
    );

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
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
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);
    sinon.assert.notCalled(events.fileChanged);

    let [error, context] = events.error.firstCall.args;

    expect(error).to.be.an.instanceOf(SyntaxError);
    expect(error.message).to.equal("An error occurred in Synchronous Error Test while watching source files for changes. \nBoom!");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
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
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);
    sinon.assert.notCalled(events.fileChanged);

    let [error, context] = events.error.firstCall.args;

    expect(error).to.be.an.instanceOf(URIError);
    expect(error.message).to.equal("An error occurred in Asynchronous Error Test while watching source files for changes. \nBoom!");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

});
