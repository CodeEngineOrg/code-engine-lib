"use strict";

const { CodeEngine } = require("../../lib");
const { delay } = require("../utils");
const { assert, expect } = require("chai");
const sinon = require("sinon");
const ono = require("@jsdevtools/ono");

describe("Events", () => {

  it('should call "start" event listeners', async () => {
    let engine = new CodeEngine();
    let engineSpy = sinon.spy();
    engine.on("start", engineSpy);

    let pluginSpy = sinon.spy();
    await engine.use({
      initialize () {
        this.engine.on("start", pluginSpy);
      }
    });

    await engine.run();

    // Both "start" event handlers should have been called
    sinon.assert.calledOnce(engineSpy);
    sinon.assert.calledOnce(pluginSpy);

    // The evvent handler should have been called with CodeEngine as its `this` context
    sinon.assert.calledOn(engineSpy, engine);
    sinon.assert.calledOn(pluginSpy, engine);

    // The same arguments should have beeen passed to both event handlers
    let [run] = engineSpy.firstCall.args;
    sinon.assert.calledWithExactly(engineSpy, run);
    sinon.assert.calledWithExactly(pluginSpy, run);

    expect(run).to.be.an("object").with.keys(
      "concurrency", "cwd", "debug", "dev", "log", "full", "partial", "changedFiles");
  });

  it('should call "finish" event listeners', async () => {
    let engine = new CodeEngine();
    let engineSpy = sinon.spy();
    engine.on("finish", engineSpy);

    let pluginSpy = sinon.spy();
    await engine.use({
      initialize () {
        this.engine.on("finish", pluginSpy);
      }
    });

    await engine.run();

    // Both "finish" event handlers should have been called
    sinon.assert.calledOnce(engineSpy);
    sinon.assert.calledOnce(pluginSpy);

    // The evvent handler should have been called with CodeEngine as its `this` context
    sinon.assert.calledOn(engineSpy, engine);
    sinon.assert.calledOn(pluginSpy, engine);

    // The same arguments should have beeen passed to both event handlers
    let [summary] = engineSpy.firstCall.args;
    sinon.assert.calledWithExactly(engineSpy, summary);
    sinon.assert.calledWithExactly(pluginSpy, summary);

    expect(summary).to.be.an("object").with.keys(
      "concurrency", "cwd", "debug", "dev", "full", "partial", "changedFiles", "log",
      "input", "output", "time");
  });

  it('should call "change" event listeners', async () => {
    let engine = new CodeEngine();
    let engineSpy = sinon.spy();
    engine.on("change", engineSpy);

    let pluginSpy = sinon.spy();
    await engine.use({
      initialize () {
        this.engine.on("change", pluginSpy);
      }
    });

    await engine.use({
      async* watch () {
        await delay(100);
        yield { path: "file1.txt", change: "modified", text: "New contents" };
      }
    });

    engine.watch();
    await delay(500);

    // Both "change" event handlers should have been called
    sinon.assert.calledOnce(engineSpy);
    sinon.assert.calledOnce(pluginSpy);

    // The evvent handler should have been called with CodeEngine as its `this` context
    sinon.assert.calledOn(engineSpy, engine);
    sinon.assert.calledOn(pluginSpy, engine);

    // The same arguments should have beeen passed to both event handlers
    let [file] = engineSpy.firstCall.args;
    sinon.assert.calledWithExactly(engineSpy, file);
    sinon.assert.calledWithExactly(pluginSpy, file);

    expect(file).to.have.property("path", "file1.txt");
    expect(file).to.have.property("change", "modified");
    expect(file).to.have.property("text", "New contents");
  });

  it('should call "log" event listeners', async () => {
    let engine = new CodeEngine();
    let engineSpy = sinon.spy();
    engine.on("log", engineSpy);

    let pluginSpy = sinon.spy();
    await engine.use({
      initialize () {
        this.engine.on("log", pluginSpy);
      }
    });

    await engine.use({
      read (run) {
        run.log("This is a log message", { foo: "bar" });
      }
    });

    await engine.run();

    // Both "log" event handlers should have been called
    sinon.assert.calledOnce(engineSpy);
    sinon.assert.calledOnce(pluginSpy);

    // The evvent handler should have been called with CodeEngine as its `this` context
    sinon.assert.calledOn(engineSpy, engine);
    sinon.assert.calledOn(pluginSpy, engine);

    // The same arguments should have beeen passed to both event handlers
    let [log] = engineSpy.firstCall.args;
    sinon.assert.calledWithExactly(engineSpy, log);
    sinon.assert.calledWithExactly(pluginSpy, log);

    expect(log).to.deep.equal({
      level: "info",
      message: "This is a log message",
      foo: "bar",
    });
  });

  it('should call "error" event listeners', async () => {
    let engine = new CodeEngine();
    let engineSpy = sinon.spy();
    engine.on("error", engineSpy);

    let pluginSpy = sinon.spy();
    await engine.use({
      initialize () {
        this.engine.on("error", pluginSpy);
      }
    });

    await engine.use({
      read () {
        throw ono.range({ foo: "bar" }, "Boom!");
      }
    });

    try {
      await engine.run();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal("An error occurred in Plugin 2 while reading source files. \nBoom!");
      expect(error.foo).to.equal("bar");
    }

    // Both "error" event handlers should have been called
    sinon.assert.calledOnce(engineSpy);
    sinon.assert.calledOnce(pluginSpy);

    // The evvent handler should have been called with CodeEngine as its `this` context
    sinon.assert.calledOn(engineSpy, engine);
    sinon.assert.calledOn(pluginSpy, engine);

    // The same arguments should have beeen passed to both event handlers
    let [error] = engineSpy.firstCall.args;
    sinon.assert.calledWithExactly(engineSpy, error);
    sinon.assert.calledWithExactly(pluginSpy, error);

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.equal("An error occurred in Plugin 2 while reading source files. \nBoom!");
    expect(error.foo).to.equal("bar");
  });

  it('should re-throw errors from "start" event handlers', async () => {
    let engine = new CodeEngine();
    let engineErrorHandler = sinon.spy();
    engine.on("error", engineErrorHandler);

    await engine.use({
      initialize () {
        // Throw an error in the "start" event
        this.engine.on("start", () => {
          throw ono.range({ foo: "bar" }, "Boom!");
        });
      }
    });

    let nextStartHandler = sinon.spy();
    let pluginErrorHandler = sinon.spy();
    await engine.use({
      initialize () {
        // This "start" event handler never gets called because the first "start" handler throws
        this.engine.on("start", nextStartHandler);

        // ...but this error handler gets called
        this.engine.on("error", pluginErrorHandler);
      }
    });

    try {
      await engine.run();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.be.equal("Boom!");
      expect(error.foo).to.equal("bar");
    }

    // The second "start" event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(nextStartHandler);

    // Both "error" handlers should have been called
    sinon.assert.calledOnce(engineErrorHandler);
    sinon.assert.calledOnce(pluginErrorHandler);

    // The same error object should have been passed to both handlers
    let [error] = engineErrorHandler.firstCall.args;
    sinon.assert.calledWithExactly(engineErrorHandler, error);
    sinon.assert.calledWithExactly(pluginErrorHandler, error);

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal("Boom!");
    expect(error.foo).to.equal("bar");
  });

  it('should re-throw errors from "finish" event handlers', async () => {
    let engine = new CodeEngine();
    let engineErrorHandler = sinon.spy();
    engine.on("error", engineErrorHandler);

    await engine.use({
      initialize () {
        // Throw an error in the "finish" event
        this.engine.on("finish", () => {
          throw ono.range({ foo: "bar" }, "Boom!");
        });
      }
    });

    let nextFinishHandler = sinon.spy();
    let pluginErrorHandler = sinon.spy();
    await engine.use({
      initialize () {
        // This "finish" event handler never gets called because the first "finish" handler throws
        this.engine.on("finish", nextFinishHandler);

        // ...but this error handler gets called
        this.engine.on("error", pluginErrorHandler);
      }
    });

    try {
      await engine.run();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.be.equal("Boom!");
      expect(error.foo).to.equal("bar");
    }

    // The second "finish" event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(nextFinishHandler);

    // Both "error" handlers should have been called
    sinon.assert.calledOnce(engineErrorHandler);
    sinon.assert.calledOnce(pluginErrorHandler);

    // The same error object should have been passed to both handlers
    let [error] = engineErrorHandler.firstCall.args;
    sinon.assert.calledWithExactly(engineErrorHandler, error);
    sinon.assert.calledWithExactly(pluginErrorHandler, error);

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal("Boom!");
    expect(error.foo).to.equal("bar");
  });

  it('should emit errors from "change" event handlers', async () => {
    let engine = new CodeEngine();
    let engineErrorHandler = sinon.spy();
    engine.on("error", engineErrorHandler);

    await engine.use({
      async* watch () {
        await delay(100);
        yield { path: "file1.txt", change: "modified", text: "New contents" };
      },

      initialize () {
        // Throw an error in the "change" event
        this.engine.on("change", () => {
          throw ono.range({ foo: "bar" }, "Boom!");
        });
      }
    });

    let nextChangeHandler = sinon.spy();
    let pluginErrorHandler = sinon.spy();
    await engine.use({
      initialize () {
        // This "change" event handler never gets called because the first "change" handler throws
        this.engine.on("change", nextChangeHandler);

        // ...but this error handler gets called
        this.engine.on("error", pluginErrorHandler);
      }
    });

    engine.watch();
    await delay(500);

    // The second "change" event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(nextChangeHandler);

    // Both "error" handlers should have been called
    sinon.assert.calledOnce(engineErrorHandler);
    sinon.assert.calledOnce(pluginErrorHandler);

    // The same error object should have been passed to both handlers
    let [error] = engineErrorHandler.firstCall.args;
    sinon.assert.calledWithExactly(engineErrorHandler, error);
    sinon.assert.calledWithExactly(pluginErrorHandler, error);

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal("Boom!");
    expect(error.foo).to.equal("bar");
  });

  it('should re-throw errors from "log" event handlers', async () => {
    let engine = new CodeEngine();
    let engineErrorHandler = sinon.spy();
    engine.on("error", engineErrorHandler);

    await engine.use({
      read (run) {
        run.log("This is a log message");
      },

      initialize () {
        // Throw an error in the "log" event
        this.engine.on("log", () => {
          throw ono.range({ foo: "bar" }, "Boom!");
        });
      }
    });

    let nextLogHandler = sinon.spy();
    let pluginErrorHandler = sinon.spy();
    await engine.use({
      initialize () {
        // This "log" event handler never gets called because the first "log" handler throws
        this.engine.on("log", nextLogHandler);

        // ...but this error handler gets called
        this.engine.on("error", pluginErrorHandler);
      }
    });

    try {
      await engine.run();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.be.equal("An error occurred in Plugin 1 while reading source files. \nBoom!");
      expect(error.foo).to.equal("bar");
    }

    // The second "log" event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(nextLogHandler);

    // Both "error" handlers should have been called
    sinon.assert.calledOnce(engineErrorHandler);
    sinon.assert.calledOnce(pluginErrorHandler);

    // The same error object should have been passed to both handlers
    let [error] = engineErrorHandler.firstCall.args;
    sinon.assert.calledWithExactly(engineErrorHandler, error);
    sinon.assert.calledWithExactly(pluginErrorHandler, error);

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal("An error occurred in Plugin 1 while reading source files. \nBoom!");
    expect(error.foo).to.equal("bar");
  });

  it('should re-throw errors from "error" event handlers', async () => {
    let engine = new CodeEngine();
    let engineErrorHandler = sinon.spy();
    engine.on("error", engineErrorHandler);

    await engine.use({
      read () {
        throw new SyntaxError("This is the original error");
      },

      initialize () {
        // Throw an error in the "error" event
        this.engine.on("error", () => {
          throw ono.range({ foo: "bar" }, "Boom!");
        });
      }
    });

    let nextErrorHandler = sinon.spy();
    await engine.use({
      initialize () {
        // This "error" event handler never gets called because the first "error" handler throws
        this.engine.on("error", nextErrorHandler);
      }
    });

    try {
      await engine.run();
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.be.equal("Boom!");
      expect(error.foo).to.equal("bar");
    }

    // The second "log" event handler should NOT have been called,
    // because the first handler threw an error
    sinon.assert.notCalled(nextErrorHandler);

    // Only the first "error" handler was called
    sinon.assert.calledOnce(engineErrorHandler);

    // The original error should have been passed to the handler
    let [error] = engineErrorHandler.firstCall.args;
    sinon.assert.calledWithExactly(engineErrorHandler, error);

    expect(error).to.be.an.instanceOf(SyntaxError);
    expect(error.message).to.be.equal("An error occurred in Plugin 1 while reading source files. \nThis is the original error");
  });

  it("should not handle errors from async event handlers", async () => {
    let unhandledRejection = sinon.spy();
    process.once("unhandledRejection", unhandledRejection);

    let engine = new CodeEngine();
    let engineErrorHandler = sinon.spy();
    engine.on("error", engineErrorHandler);

    await engine.use({
      initialize () {
        // This is an ASYNC event handler, so its error will NOT be caught and "error" events will NOT fire
        this.engine.on("start", async () => {
          await delay(100);
          throw ono.range({ foo: "bar" }, "Boom!");
        });
      }
    });

    let nextStartHandler = sinon.spy();
    let pluginErrorHandler = sinon.spy();
    await engine.use({
      initialize () {
        // This "start" event handler DOES get called, because the previous event handler throws its error asynchronously
        this.engine.on("start", nextStartHandler);

        // This "error" handler does NOT get called, because the error is thrown asynchronously
        this.engine.on("error", pluginErrorHandler);
      }
    });

    // It runs successfully, because the error is thrown asynchronously
    await engine.run();
    await delay(500);

    // The 2nd plugin's "start" handler was called before the error was thrown
    sinon.assert.calledOnce(nextStartHandler);

    // None of the CodeEngine error handlers were called, because the error was thrown asynchronously
    sinon.assert.notCalled(engineErrorHandler);
    sinon.assert.notCalled(pluginErrorHandler);

    // The error was caught by the global unhandled rejection handler
    sinon.assert.calledOnce(unhandledRejection);
    let [error] = unhandledRejection.firstCall.args;

    expect(error).to.be.an.instanceOf(RangeError);
    expect(error.message).to.be.equal("Boom!");
    expect(error.foo).to.equal("bar");
  });

});
