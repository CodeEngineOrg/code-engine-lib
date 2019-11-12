/* eslint-disable no-new-wrappers, no-new-object */
"use strict";

const CodeEngine = require("../utils/code-engine");
const { getCallArg, testThreadConsistency } = require("../utils");
const { expect } = require("chai");
const sinon = require("sinon");

describe("Context", () => {
  testThreadConsistency((createModule) => {

    function isAnyContext (context) {
      expect(context).to.be.an("object").and.include.keys("cwd", "concurrency", "debug", "dev", "logger");
      expect(context.cwd).to.be.a("string").and.not.empty;
      expect(context.concurrency).to.be.a("number").above(0);
      expect(context.debug).to.be.a("boolean");
      expect(context.dev).to.be.a("boolean");
      expect(context.logger).to.be.an("object");
      return true;
    }

    function isContext (context) {
      isAnyContext(context);
      expect(context).to.have.keys("cwd", "concurrency", "debug", "dev", "logger");
      return true;
    }

    function isBuildContext (context) {
      isAnyContext(context);
      expect(context).to.have.keys("cwd", "concurrency", "debug", "dev", "fullBuild", "partialBuild", "changedFiles", "logger");
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

      let engine = CodeEngine.create();
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

      let engine = CodeEngine.create();
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

      let engine = CodeEngine.create();
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

      let engine = CodeEngine.create();
      await engine.use(plugin);
      await engine.build();

      expect(context).to.satisfy(isBuildContext);
    });

    it("should be a BuildContext object in the Plugin.processFile method", async () => {
      let plugin = {
        name: "Context Test",
        read () { return { path: "file.txt" }; },
        processFile: await createModule((file, ctx) => {
          file.text = JSON.stringify({ ...ctx, logger: {}});
          return file;
        })
      };

      let spy = sinon.spy();

      let engine = CodeEngine.create();
      await engine.use(plugin, spy);
      await engine.build();

      sinon.assert.calledOnce(spy);
      let file = spy.firstCall.args[0];
      let context = JSON.parse(file.text);

      expect(context).to.satisfy(isBuildContext);
    });

    it("should log messages", async () => {
      let plugin = {
        name: "Logger Test",
        read () {
          return { path: "file1.txt" };
        },
        processFile: await createModule((file, { logger }) => {
          logger.log("this is a log message", { foo: "bar", isLogTest: true });
          logger.debug("this is a debug message", { fizz: "buzz", isLogTest: true });
          logger.warn("this is a warning message", { uh: "oh!", isLogTest: true });
          logger.error("this is an error message", { ka: "boom!", isLogTest: true });
        })
      };

      let engine = CodeEngine.create({ debug: true });
      let log = sinon.spy();
      engine.on("log", log);
      await engine.use(plugin);
      await engine.build();

      // The log method may get invoked extra times due to CodeEngine debug messages
      expect(log.callCount).to.be.at.least(4);
      let logEntries = getCallArg(log).filter((entry) => entry.isLogTest);
      expect(logEntries[0]).to.deep.equal({ level: "info", message: "this is a log message", foo: "bar", isLogTest: true });
      expect(logEntries[1]).to.deep.equal({ level: "debug", message: "this is a debug message", fizz: "buzz", isLogTest: true });
      expect(logEntries[2]).to.deep.equal({ level: "warning", message: "this is a warning message", uh: "oh!", isLogTest: true });
      expect(logEntries[3]).to.deep.equal({ level: "error", message: "this is an error message", ka: "boom!", isLogTest: true });
    });

    it("should log errors", async () => {
      let plugin = {
        name: "Logger Test",
        read () {
          return { path: "file1.txt" };
        },
        processFile: await createModule((file, { logger }) => {
          logger.warn(new Error("this is a warning error"), { uh: "oh!", isLogTest: true });
          logger.error(new Error("this is an error"), { ka: "boom!", isLogTest: true });
        })
      };

      let engine = CodeEngine.create({ debug: true });
      let log = sinon.spy();
      engine.on("log", log);
      await engine.use(plugin);
      await engine.build();

      // The log method may get invoked extra times due to CodeEngine debug messages
      expect(log.callCount).to.be.at.least(2);
      let [warning, error] = getCallArg(log).filter((entry) => entry.isLogTest);

      expect(warning).to.have.keys("level", "error", "message", "uh", "isLogTest");
      expect(warning.level).to.equal("warning");
      expect(warning.uh).to.equal("oh!");
      expect(warning.isLogTest).to.equal(true);
      expect(warning.message).to.equal(warning.error.stack);
      expect(warning.error.name).to.equal("Error");
      expect(warning.error.message).to.equal("this is a warning error");
      expect(warning.error.stack).to.include("this is a warning error");

      expect(error).to.have.keys("level", "error", "message", "ka", "isLogTest");
      expect(error.level).to.equal("error");
      expect(error.ka).to.equal("boom!");
      expect(error.isLogTest).to.equal(true);
      expect(error.message).to.equal(error.error.stack);
      expect(error.error.name).to.equal("Error");
      expect(error.error.message).to.equal("this is an error");
      expect(error.error.stack).to.include("this is an error");
    });

  });
});
