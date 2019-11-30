"use strict";

const CodeEngine = require("../../");
const { delay, getFiles, iterateAll } = require("../utils");
const { expect } = require("chai");
const sinon = require("sinon");

// CI environments are slow, so use a larger time buffer
const TIME_BUFFER = process.env.CI ? 200 : 75;
const watchDelay = process.env.CI ? 300 : 100;

describe("Plugin.watch()", () => {

  function createEvents (engine) {
    let events = {
      buildStarting: sinon.spy(),
      buildFinished: sinon.spy(),
      error: sinon.spy(),
    };

    engine.on("error", events.error);
    engine.on("buildStarting", events.buildStarting);
    engine.on("buildFinished", events.buildFinished);

    return events;
  }

  it("should do nothing if no plugins implement watch", async () => {
    let plugin1 = { clean () {} };
    let plugin2 = { read () {} };

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);
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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2, plugin3);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.calledOnce(plugin1.watch);
    sinon.assert.calledOnce(plugin2.watch);
    sinon.assert.calledOnce(plugin3.watch);

    sinon.assert.notCalled(events.error);
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);
  });

  it("should be called with the plugin's `this` context", async () => {
    let plugin1 = {
      watch: sinon.spy(),
    };
    let plugin2 = {
      watch: sinon.spy(),
    };

    let engine = new CodeEngine({ watchDelay });
    await engine.use(plugin1, plugin2);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);

    let preBuild = events.buildStarting.firstCall.args[0];
    let postBuild = events.buildFinished.firstCall.args[0];

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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledTwice(plugin2);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(2);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("change", "created");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("change", "modified");

    let postBuild = events.buildFinished.firstCall.args[0];
    expect(postBuild.input.fileCount).to.equal(2);
    expect(postBuild.output.fileCount).to.equal(2);
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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2, plugin3);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.notCalled(events.error);

    sinon.assert.calledOnce(events.buildStarting);
    let preBuild = events.buildStarting.firstCall.args[0];
    expect(preBuild.changedFiles).to.have.lengthOf(3);
    expect(preBuild.changedFiles[0]).to.have.property("change", "deleted");
    expect(preBuild.changedFiles[1]).to.have.property("change", "deleted");
    expect(preBuild.changedFiles[2]).to.have.property("change", "deleted");

    sinon.assert.calledOnce(events.buildFinished);
    let postBuild = events.buildFinished.firstCall.args[0];
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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);

    let build = events.buildStarting.firstCall.args[0];
    expect(build.changedFiles[0]).to.have.property("name", "file1.txt");
    expect(build.changedFiles[0]).to.have.property("text", "Hello, world!");
    expect(build.changedFiles[1]).to.have.property("name", "file2.txt");
    expect(build.changedFiles[1]).to.have.property("text", "Hello again, world!");
    expect(build.changedFiles[2]).to.have.property("name", "file3.txt");
    expect(build.changedFiles[2]).to.have.property("text", "Goodbye, cruel world!");
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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);

    let build = events.buildFinished.firstCall.args[0];
    expect(build.changedFiles[0]).to.have.property("name", "file1.txt");
    expect(build.changedFiles[0]).to.have.property("text", "");
    expect(build.changedFiles[1]).to.have.property("name", "file2.txt");
    expect(build.changedFiles[1]).to.have.property("text", "");
    expect(build.changedFiles[2]).to.have.property("name", "file3.txt");
    expect(build.changedFiles[2]).to.have.property("text", "");
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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2);
    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledTwice(plugin2);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(2);
    expect(files[0]).to.have.property("name", "file1.txt");
    expect(files[0]).to.have.property("text", "Hello, world!");
    expect(files[1]).to.have.property("name", "file2.txt");
    expect(files[1]).to.have.property("text", "Hello again, world!");
  });

  it("should include changes made in the buildStarting event in the build", async () => {
    let plugin1 = {
      async* watch () {
        await delay();
        yield { path: "file1.txt", change: "created", text: "Hello, world!" };
        yield { path: "file2.txt", change: "modified", text: "Hello again, world!" };
        yield { path: "file3.txt", change: "deleted", text: "Goodbye, cruel world!" };
      }
    };
    let plugin2 = sinon.stub().returnsArg(0);

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin1, plugin2);

    engine.on("buildStarting", ({ changedFiles }) => {
      for (let file of changedFiles) {
        file.change = "created";
        file.extension = ".html";
        file.text += "!!!";
        file.metadata.foo = "bar";
      }
    });

    engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    sinon.assert.calledThrice(plugin2);

    let files = getFiles(plugin2);
    expect(files).to.have.lengthOf(3);

    expect(files[0]).to.have.property("change", "created");
    expect(files[0]).to.have.property("name", "file1.html");
    expect(files[0]).to.have.property("text", "Hello, world!!!!");
    expect(files[0].metadata).to.have.property("foo", "bar");

    expect(files[1]).to.have.property("change", "created");
    expect(files[1]).to.have.property("name", "file2.html");
    expect(files[1]).to.have.property("text", "Hello again, world!!!!");
    expect(files[1].metadata).to.have.property("foo", "bar");

    expect(files[2]).to.have.property("change", "created");
    expect(files[2]).to.have.property("name", "file3.html");
    expect(files[2]).to.have.property("text", "Goodbye, cruel world!!!!");
    expect(files[2].metadata).to.have.property("foo", "bar");

    let postBuild = events.buildFinished.firstCall.args[0];
    expect(postBuild.input.fileCount).to.equal(3);
    expect(postBuild.output.fileCount).to.equal(3);
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

    let engine = new CodeEngine({ watchDelay: 100 });  // Use the same watch delay, even in CI
    let events = createEvents(engine);
    await engine.use(plugin);
    engine.watch();

    // 100ms: A file was yielded at 50ms, so the build won't start until 150ms
    await delay(100);
    sinon.assert.notCalled(events.error);
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);

    // 200ms: A build occurred at 150ms
    await delay(100);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);
    expect(events.buildStarting.firstCall.args[0].changedFiles).to.have.lengthOf(3);
    expect(events.buildFinished.firstCall.args[0].changedFiles).to.have.lengthOf(3);

    // 400ms: A file was yielded at 350ms and another at 400ms, so the build won't start until 500ms
    await delay(200);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledOnce(events.buildStarting);
    sinon.assert.calledOnce(events.buildFinished);

    // 600ms: A build occurred at 500ms
    await delay(200);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledTwice(events.buildStarting);
    sinon.assert.calledTwice(events.buildFinished);
    expect(events.buildStarting.secondCall.args[0].changedFiles).to.have.lengthOf(2);
    expect(events.buildFinished.secondCall.args[0].changedFiles).to.have.lengthOf(2);

    // 900ms: A build occurred at 700ms
    await delay(300);
    sinon.assert.notCalled(events.error);
    sinon.assert.calledThrice(events.buildStarting);
    sinon.assert.calledThrice(events.buildFinished);
    expect(events.buildStarting.thirdCall.args[0].changedFiles).to.have.lengthOf(1);
    expect(events.buildFinished.thirdCall.args[0].changedFiles).to.have.lengthOf(1);

    // 1100ms: A build occurred at 1100ms
    await delay(200);
    sinon.assert.notCalled(events.error);
    sinon.assert.callCount(events.buildStarting, 4);
    sinon.assert.callCount(events.buildFinished, 4);
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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin);
    await engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.calledOnce(events.error);
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);

    let error = events.error.firstCall.args[0];
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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin);
    await engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.calledOnce(events.error);
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);

    let error = events.error.firstCall.args[0];
    expect(error).to.be.an.instanceOf(Error);
    expect(error).not.to.be.an.instanceOf(SyntaxError);
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

    let engine = new CodeEngine({ watchDelay });
    let events = createEvents(engine);
    await engine.use(plugin);
    await engine.watch();
    await delay(watchDelay + TIME_BUFFER);

    sinon.assert.calledOnce(events.error);
    sinon.assert.notCalled(events.buildStarting);
    sinon.assert.notCalled(events.buildFinished);

    let error = events.error.firstCall.args[0];
    expect(error).to.be.an.instanceOf(Error);
    expect(error).not.to.be.an.instanceOf(URIError);
    expect(error.message).to.equal("An error occurred in Asynchronous Error Test while watching source files for changes. \nBoom!");
  });

});
