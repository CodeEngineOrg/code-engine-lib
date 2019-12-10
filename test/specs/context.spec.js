/* eslint-disable no-new-wrappers, no-new-object */
"use strict";

const { CodeEngine } = require("../../");
const { getCallArg, testThreadConsistency } = require("../utils");
const { expect } = require("chai");
const sinon = require("sinon");

describe("Context", () => {
  testThreadConsistency((createModule) => {

    function isAnyContext (context) {
      expect(context).to.be.an("object").and.include.keys("cwd", "concurrency", "debug", "dev", "log");
      expect(context.cwd).to.be.a("string").and.not.empty;
      expect(context.concurrency).to.be.a("number").above(0);
      expect(context.debug).to.be.a("boolean");
      expect(context.dev).to.be.a("boolean");
      expect(context.log).to.be.a("function");
      return true;
    }

    function isContext (context) {
      isAnyContext(context);
      expect(context).to.have.keys("cwd", "concurrency", "debug", "dev", "log");
      return true;
    }

    function isBuildContext (context) {
      isAnyContext(context);
      expect(context).to.have.keys("cwd", "concurrency", "debug", "dev", "fullBuild", "partialBuild", "changedFiles", "log");
      expect(context.fullBuild).to.be.a("boolean");
      expect(context.partialBuild).to.be.a("boolean");
      expect(context.changedFiles).to.be.an("array");

      for (let file of context.changedFiles) {
        expect(file).to.be.a("File").with.keys("path", "");
      }

      return true;
    }

    it("should be a Context object in the Plugin.clean method", async () => {
      let context;

      let plugin = {
        name: "Context Test",
        clean (ctx) { context = { ...ctx }; }
      };

      let engine = new CodeEngine();
      await engine.use(plugin);
      await engine.clean();

      expect(context).to.satisfy(isContext);
    });

    it("should be a Context object in the Plugin.dispose method", async () => {
      let context;

      let plugin = {
        name: "Context Test",
        dispose (ctx) { context = { ...ctx }; }
      };

      let engine = new CodeEngine();
      await engine.use(plugin);
      await engine.dispose();

      expect(context).to.satisfy(isContext);
    });

    it("should be a BuildContext object in the Plugin.read method", async () => {
      let context;

      let plugin = {
        name: "Context Test",
        read (ctx) { context = { ...ctx }; }
      };

      let engine = new CodeEngine();
      await engine.use(plugin);
      await engine.build();

      expect(context).to.satisfy(isBuildContext);
    });

    it("should be a BuildContext object in the Plugin.processFiles method", async () => {
      let context;

      let plugin = {
        name: "Context Test",
        processFiles (files, ctx) { context = { ...ctx }; }
      };

      let engine = new CodeEngine();
      await engine.use(plugin);
      await engine.build();

      expect(context).to.satisfy(isBuildContext);
    });

    it("should be a BuildContext object in the Plugin.processFile method", async () => {
      let plugin = {
        name: "Context Test",
        read () { return { path: "file.txt" }; },
        processFile: await createModule((file, ctx) => {
          file.text = JSON.stringify({ ...ctx, log: null });
          return file;
        })
      };

      let spy = sinon.spy();

      let engine = new CodeEngine();
      await engine.use(plugin, spy);
      await engine.build();

      sinon.assert.calledOnce(spy);
      let file = spy.firstCall.args[0];
      let context = JSON.parse(file.text);

      context.log = () => undefined;
      expect(context).to.satisfy(isBuildContext);
    });

    it("should log messages", async () => {
      let plugin = {
        name: "Log Test",
        read () {
          return { path: "file1.txt" };
        },
        processFile: await createModule((file, { log }) => {
          log("this is a log message", { foo: "bar", isLogTest: true });
          log.info("this is an info message", { up: "down", isLogTest: true });
          log.debug("this is a debug message", { fizz: "buzz", isLogTest: true });
          log.warn("this is a warning message", { uh: "oh!", isLogTest: true });
          log.error("this is an error message", { ka: "boom!", isLogTest: true });
        })
      };

      let engine = new CodeEngine({ debug: true });
      let log = sinon.spy();
      engine.on("log", log);
      await engine.use(plugin);
      await engine.build();

      // The log method may get invoked extra times due to CodeEngine debug messages
      expect(log.callCount).to.be.at.least(5);
      let logEntries = getCallArg(log, 0).filter((entry) => entry.isLogTest);

      expect(logEntries[0]).to.deep.equal({ level: "info", message: "this is a log message", foo: "bar", isLogTest: true });
      expect(logEntries[1]).to.deep.equal({ level: "info", message: "this is an info message", up: "down", isLogTest: true });
      expect(logEntries[2]).to.deep.equal({ level: "debug", message: "this is a debug message", fizz: "buzz", isLogTest: true });
      expect(logEntries[3]).to.deep.equal({ level: "warning", message: "this is a warning message", uh: "oh!", isLogTest: true });
      expect(logEntries[4]).to.deep.equal({ level: "error", message: "this is an error message", ka: "boom!", isLogTest: true });
    });

    it("should log errors", async () => {
      let plugin = {
        name: "Log Test",
        read () {
          return { path: "file1.txt" };
        },
        processFile: await createModule((file, { log }) => {
          log(new RangeError("this is an error"), { oh: "no!", isLogTest: true });
          log.warn(new URIError("this is a warning error"), { uh: "oh!", isLogTest: true });
          log.error(new TypeError("this is an error"), { ka: "boom!", isLogTest: true });
        })
      };

      let engine = new CodeEngine({ debug: true });
      let log = sinon.spy();
      engine.on("log", log);
      await engine.use(plugin);
      await engine.build();

      // The log method may get invoked extra times due to CodeEngine debug messages
      expect(log.callCount).to.be.at.least(3);
      let logEntries = getCallArg(log, 0).filter((entry) => entry.isLogTest);

      expect(logEntries[0]).to.have.keys("level", "error", "message", "oh", "isLogTest");
      expect(logEntries[0].level).to.equal("error");
      expect(logEntries[0].oh).to.equal("no!");
      expect(logEntries[0].isLogTest).to.equal(true);
      expect(logEntries[0].message).to.equal(logEntries[0].error.stack);
      expect(logEntries[0].error).to.be.an.instanceOf(RangeError);
      expect(logEntries[0].error.name).to.equal("RangeError");
      expect(logEntries[0].error.message).to.equal("this is an error");
      expect(logEntries[0].error.stack).to.include("this is an error");

      expect(logEntries[1]).to.have.keys("level", "error", "message", "uh", "isLogTest");
      expect(logEntries[1].level).to.equal("warning");
      expect(logEntries[1].uh).to.equal("oh!");
      expect(logEntries[1].isLogTest).to.equal(true);
      expect(logEntries[1].message).to.equal(logEntries[1].error.stack);
      expect(logEntries[1].error).to.be.an.instanceOf(URIError);
      expect(logEntries[1].error.name).to.equal("URIError");
      expect(logEntries[1].error.message).to.equal("this is a warning error");
      expect(logEntries[1].error.stack).to.include("this is a warning error");

      expect(logEntries[2]).to.have.keys("level", "error", "message", "ka", "isLogTest");
      expect(logEntries[2].level).to.equal("error");
      expect(logEntries[2].ka).to.equal("boom!");
      expect(logEntries[2].isLogTest).to.equal(true);
      expect(logEntries[2].message).to.equal(logEntries[2].error.stack);
      expect(logEntries[2].error).to.be.an.instanceOf(TypeError);
      expect(logEntries[2].error.name).to.equal("TypeError");
      expect(logEntries[2].error.message).to.equal("this is an error");
      expect(logEntries[2].error.stack).to.include("this is an error");
    });

  });
});
