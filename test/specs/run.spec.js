/* eslint-disable no-new-wrappers, no-new-object */
"use strict";

const { CodeEngine } = require("../../lib");
const { getCallArg, testThreadConsistency } = require("../utils");
const { expect } = require("chai");
const sinon = require("sinon");

describe("Run object", () => {
  testThreadConsistency((createModule) => {

    function isRun (run) {
      expect(run).to.be.an("object").with.keys(
        "cwd", "concurrency", "full", "partial", "debug", "dev", "changedFiles", "log");
      expect(run.cwd).to.be.a("string").and.not.empty;
      expect(run.concurrency).to.be.a("number").above(0);
      expect(run.full).to.be.a("boolean");
      expect(run.partial).to.be.a("boolean");
      expect(run.debug).to.be.a("boolean");
      expect(run.dev).to.be.a("boolean");
      expect(run.changedFiles).to.be.an("array");
      expect(run.log).to.be.a("function");

      for (let file of run.changedFiles) {
        expect(file).to.be.a("File").with.keys("path");
      }

      return true;
    }

    it("should be passed to the Plugin.read method", async () => {
      let run;

      let plugin = {
        read (r) { run = { ...r }; }
      };

      let engine = new CodeEngine();
      await engine.use(plugin);
      await engine.run();

      expect(run).to.satisfy(isRun);
    });

    it("should be passed to the Plugin.processFiles method", async () => {
      let run;

      let plugin = {
        processFiles (files, r) { run = { ...r }; }
      };

      let engine = new CodeEngine();
      await engine.use(plugin);
      await engine.run();

      expect(run).to.satisfy(isRun);
    });

    it("should be passed to the Plugin.processFile method", async () => {
      let plugin = {
        read () { return { path: "file.txt" }; },
        processFile: await createModule((file, run) => {
          file.text = JSON.stringify({ ...run, log: null });
          return file;
        })
      };

      let spy = sinon.spy();

      let engine = new CodeEngine();
      await engine.use(plugin, spy);
      await engine.run();

      sinon.assert.calledOnce(spy);
      let file = spy.firstCall.args[0];
      let run = JSON.parse(file.text);

      run.log = () => undefined;
      expect(run).to.satisfy(isRun);
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
      await engine.run();

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
      await engine.run();

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
