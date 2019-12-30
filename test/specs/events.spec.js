"use strict";

const { CodeEngine } = require("../../lib");
const { delay } = require("../utils");
const { assert, expect } = require("chai");
const sinon = require("sinon");
const ono = require("ono");

describe("Plugin events", () => {

  it("should call BuildStarting event listeners", async () => {
    let plugin1 = { onBuildStarting: sinon.spy() };
    let plugin2 = { onBuildStarting: sinon.spy() };

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2);
    await engine.build();

    // The BuildStarting event handler of each plugin should have been called
    sinon.assert.calledOnce(plugin1.onBuildStarting);
    sinon.assert.calledOnce(plugin2.onBuildStarting);

    // The evvent handler should have been called with the plugin as its `this` context
    sinon.assert.calledOn(plugin1.onBuildStarting, plugin1);
    sinon.assert.calledOn(plugin2.onBuildStarting, plugin2);

    // The same arguments should have beeen passed to both plugins
    let [context] = plugin2.onBuildStarting.firstCall.args;

    sinon.assert.calledWithExactly(plugin1.onBuildStarting, context);

    expect(context).to.be.an("object").with.keys(
      "concurrency", "cwd", "debug", "dev", "log", "fullBuild", "partialBuild", "changedFiles");
  });

  it("should call BuildFinished event listeners", async () => {
    let plugin1 = { onBuildFinished: sinon.spy() };
    let plugin2 = { onBuildFinished: sinon.spy() };

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2);
    await engine.build();

    // The BuildFinished event handler of each plugin should have been called
    sinon.assert.calledOnce(plugin1.onBuildFinished);
    sinon.assert.calledOnce(plugin2.onBuildFinished);

    // The evvent handler should have been called with the plugin as its `this` context
    sinon.assert.calledOn(plugin1.onBuildFinished, plugin1);
    sinon.assert.calledOn(plugin2.onBuildFinished, plugin2);

    // The same arguments should have beeen passed to both plugins
    let [summary] = plugin2.onBuildFinished.firstCall.args;

    sinon.assert.calledWithExactly(plugin1.onBuildFinished, summary);

    expect(summary).to.be.an("object").with.keys(
      "concurrency", "cwd", "debug", "dev", "fullBuild", "partialBuild", "changedFiles", "log",
      "input", "output", "time");
  });

  it("should call FileChanged event listeners", async () => {
    let plugin1 = { onFileChanged: sinon.spy() };
    let plugin2 = {
      async* watch () {
        await delay(100);
        yield { path: "file1.txt", change: "modified", text: "New contents" };
      }
    };
    let plugin3 = { onFileChanged: sinon.spy() };

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2, plugin3);
    engine.watch();
    await delay(500);

    // The FileChanged event handler of each plugin should have been called
    sinon.assert.calledOnce(plugin1.onFileChanged);
    sinon.assert.calledOnce(plugin3.onFileChanged);

    // The evvent handler should have been called with the plugin as its `this` context
    sinon.assert.calledOn(plugin1.onFileChanged, plugin1);
    sinon.assert.calledOn(plugin3.onFileChanged, plugin3);

    // The same arguments should have beeen passed to both plugins
    let [file, context] = plugin3.onFileChanged.firstCall.args;

    sinon.assert.calledWithExactly(plugin1.onFileChanged, file, context);

    expect(file).to.have.property("path", "file1.txt");
    expect(file).to.have.property("change", "modified");
    expect(file).to.have.property("text", "New contents");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

  it("should call Log event listeners", async () => {
    let plugin1 = { onLog: sinon.spy() };
    let plugin2 = { read: (context) => context.log("This is a log message", { foo: "bar" }) };
    let plugin3 = { onLog: sinon.spy() };

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2, plugin3);
    await engine.build();

    // The Log event handler of each plugin should have been called
    sinon.assert.calledOnce(plugin1.onLog);
    sinon.assert.calledOnce(plugin3.onLog);

    // The evvent handler should have been called with the plugin as its `this` context
    sinon.assert.calledOn(plugin1.onLog, plugin1);
    sinon.assert.calledOn(plugin3.onLog, plugin3);

    // The same arguments should have beeen passed to both plugins
    let [log, context] = plugin3.onLog.firstCall.args;

    sinon.assert.calledWithExactly(plugin1.onLog, log, context);

    expect(log).to.deep.equal({
      level: "info",
      message: "This is a log message",
      foo: "bar",
    });

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

  it("should call Error event listeners", async () => {
    let plugin1 = { onError: sinon.spy() };
    let plugin2 = { read () { throw ono.range({ foo: "bar" }, "Boom!"); } };
    let plugin3 = { onError: sinon.spy() };

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2, plugin3);

    try {
      await engine.build();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal("An error occurred in Plugin 2 while reading source files. \nBoom!");
      expect(error.foo).to.equal("bar");
    }

    // The Error event handler of each plugin should have been called
    sinon.assert.calledOnce(plugin1.onError);
    sinon.assert.calledOnce(plugin3.onError);

    // The evvent handler should have been called with the plugin as its `this` context
    sinon.assert.calledOn(plugin1.onError, plugin1);
    sinon.assert.calledOn(plugin3.onError, plugin3);

    // The same arguments should have beeen passed to both plugins
    sinon.assert.calledWithExactly(plugin1.onError, ...plugin3.onError.firstCall.args);

    let [error, context] = plugin1.onError.firstCall.args;

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.equal("An error occurred in Plugin 2 while reading source files. \nBoom!");
    expect(error.foo).to.equal("bar");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

  it("should re-throw errors from BuildStarting event handlers", async () => {
    let plugin1 = {
      onBuildStarting () {
        throw ono.range({ foo: "bar" }, "Boom!");
      }
    };

    let plugin2 = {
      onBuildStarting: sinon.spy(),
      onError: sinon.spy()
    };

    let engine = new CodeEngine();
    let errorHandler = sinon.spy();
    engine.on("error", errorHandler);
    await engine.use(plugin1, plugin2);

    try {
      await engine.build();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.be.equal('An error occurred in Plugin 1 while handling a "buildStarting" event. \nBoom!');
      expect(error.foo).to.equal("bar");
    }

    // The second BuildStarting event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(plugin2.onBuildStarting);

    // The error event should have been emitted, and the onError handler called
    sinon.assert.calledOnce(errorHandler);
    sinon.assert.calledOnce(plugin2.onError);

    // The same error object should have been passed to both handlers
    sinon.assert.calledWithExactly(errorHandler, ...plugin2.onError.firstCall.args);

    let [error, context] = errorHandler.firstCall.args;

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal('An error occurred in Plugin 1 while handling a "buildStarting" event. \nBoom!');
    expect(error.foo).to.equal("bar");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

  it("should re-throw errors from BuildFinished event handlers", async () => {
    let plugin1 = {
      onBuildFinished () {
        throw ono.range({ foo: "bar" }, "Boom!");
      }
    };

    let plugin2 = {
      onBuildFinished: sinon.spy(),
      onError: sinon.spy()
    };

    let engine = new CodeEngine();
    let errorHandler = sinon.spy();
    engine.on("error", errorHandler);
    await engine.use(plugin1, plugin2);

    try {
      await engine.build();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.be.equal('An error occurred in Plugin 1 while handling a "buildFinished" event. \nBoom!');
      expect(error.foo).to.equal("bar");
    }

    // The second BuildFinished event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(plugin2.onBuildFinished);

    // The error event should have been emitted, and the onError handler called
    sinon.assert.calledOnce(errorHandler);
    sinon.assert.calledOnce(plugin2.onError);

    // The same error object should have been passed to both handlers
    sinon.assert.calledWithExactly(errorHandler, ...plugin2.onError.firstCall.args);

    let [error, context] = errorHandler.firstCall.args;

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal('An error occurred in Plugin 1 while handling a "buildFinished" event. \nBoom!');
    expect(error.foo).to.equal("bar");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

  it("should emit errors from FileChanged event handlers", async () => {
    let plugin1 = {
      onFileChanged () {
        throw ono.range({ foo: "bar" }, "Boom!");
      }
    };

    let plugin2 = {
      async* watch () {
        await delay(100);
        yield { path: "file1.txt", change: "modified", text: "New contents" };
      }
    };

    let plugin3 = {
      onFileChanged: sinon.spy(),
      onError: sinon.spy()
    };

    let engine = new CodeEngine();
    let errorHandler = sinon.spy();
    engine.on("error", errorHandler);
    await engine.use(plugin1, plugin2, plugin3);

    engine.watch();
    await delay(500);

    // The second FileChanged event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(plugin3.onFileChanged);

    // The error event should have been emitted, and the onError handler called
    sinon.assert.calledOnce(errorHandler);
    sinon.assert.calledOnce(plugin3.onError);

    // The same error object should have been passed to both handlers
    sinon.assert.calledWithExactly(errorHandler, ...plugin3.onError.firstCall.args);

    let [error, context] = errorHandler.firstCall.args;

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal('An error occurred in Plugin 1 while handling a "fileChanged" event. \nBoom!');
    expect(error.foo).to.equal("bar");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

  it("should re-throw errors from Log event handlers", async () => {
    let plugin1 = {
      onLog () {
        throw ono.range({ foo: "bar" }, "Boom!");
      }
    };

    let plugin2 = {
      onLog: sinon.spy(),
      onError: sinon.spy()
    };

    let plugin3 = {
      read ({ log }) {
        log("This is a log message");
      }
    };

    let engine = new CodeEngine();
    let errorHandler = sinon.spy();
    engine.on("error", errorHandler);
    await engine.use(plugin1, plugin2, plugin3);

    try {
      await engine.build();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.be.equal(
        "An error occurred in Plugin 3 while reading source files. \n" +
        'An error occurred in Plugin 1 while handling a "log" event. \n' +
        "Boom!"
      );
      expect(error.foo).to.equal("bar");
    }

    // The second Log event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(plugin2.onLog);

    // The error event should have been emitted, and the onError handler called
    sinon.assert.calledOnce(errorHandler);
    sinon.assert.calledOnce(plugin2.onError);

    // The same error object should have been passed to both handlers
    sinon.assert.calledWithExactly(errorHandler, ...plugin2.onError.firstCall.args);

    let [error, context] = errorHandler.firstCall.args;

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal(
      "An error occurred in Plugin 3 while reading source files. \n" +
      'An error occurred in Plugin 1 while handling a "log" event. \n' +
      "Boom!"
    );
    expect(error.foo).to.equal("bar");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

  it("should re-throw errors from Error event handlers", async () => {
    let plugin1 = {
      onError () {
        throw ono.range({ foo: "bar" }, "Boom!");
      }
    };

    let plugin2 = {
      onError: sinon.spy(),
    };

    let plugin3 = {
      read () {
        throw ono.uri({ fizz: "buzz" }, "Onoes!");
      }
    };

    let engine = new CodeEngine();
    let errorHandler = sinon.spy();
    engine.on("error", errorHandler);
    await engine.use(plugin1, plugin2, plugin3);

    try {
      await engine.build();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.be.equal('An error occurred in Plugin 1 while handling a "error" event. \nBoom!');
      expect(error.foo).to.equal("bar");
      expect(error).not.to.have.property("fizz");
    }

    // The second Log event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(plugin2.onError);

    // The error event should have been emitted
    sinon.assert.calledOnce(errorHandler);

    let [error, context] = errorHandler.firstCall.args;

    expect(error).to.be.an.instanceOf(URIError);
    expect(error.message).to.be.equal("An error occurred in Plugin 3 while reading source files. \nOnoes!");
    expect(error.fizz).to.equal("buzz");
    expect(error).not.to.have.property("foo");

    expect(context).to.be.an("object").with.keys("concurrency", "cwd", "debug", "dev", "log");
  });

  it("should re-throw asynchronous errors from event handlers", async () => {
    let unhandledRejection = sinon.spy();
    process.once("unhandledRejection", unhandledRejection);

    let plugin1 = {
      async onBuildStarting () {
        await delay(100);
        throw ono.range({ foo: "bar" }, "Boom!");
      }
    };

    let plugin2 = {
      onBuildStarting: sinon.spy(),
      onError: sinon.spy()
    };

    let engine = new CodeEngine();
    let errorHandler = sinon.spy();
    engine.on("error", errorHandler);
    await engine.use(plugin1, plugin2);

    // The build runs successfully, because the error is thrown asynchronously
    await engine.build();
    await delay(100);

    // Plugin 2's onBuildStarting handler was called before the error was thrown
    sinon.assert.calledOnce(plugin2.onBuildStarting);

    // None of the CodeEngine error handlers were called, because the error was thrown asynchronously
    sinon.assert.notCalled(plugin2.onError);
    sinon.assert.notCalled(errorHandler);

    // The error was caught by the global unhandled rejection handler
    sinon.assert.calledOnce(unhandledRejection);
    let [error] = unhandledRejection.firstCall.args;

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal('An error occurred in Plugin 1 while handling a "buildStarting" event. \nBoom!');
    expect(error.foo).to.equal("bar");
  });

});
