"use strict";

/** @typedef { import("sinon").SinonSpy } SinonSpy */
/** @typedef { import("sinon").SinonSpyCall } SinonSpyCall */
const tmp = require("tmp");
const { promises: fs } = require("fs");

// Gracefully cleanup temp files
tmp.setGracefulCleanup();

const utils = module.exports = {
  /**
   * Returns a promise that resolves after the specified amount of time.
   *
   * @param timeout {number} - The number of milliseconds to delay
   * @param [result] {any} - The promise result
   */
  delay (timeout, result) {
    return new Promise((resolve) => setTimeout(() => resolve(result), timeout));
  },


  /**
   * Returns the specified argument from each Sinon call.
   *
   * @param spy SinonSpy - The Sinon Spy to return arguments from
   * @param argIndex - The argument to return. Defaults to the first arg.
   * @returns {Array}
   */
  getCallArg (spy, argIndex) {
    return spy.getCalls().map((call) => call.args[argIndex]);
  },


  /**
   * Returns the file from each `processFile()` call.
   *
   * @param spy {SinonSpy} - A Sinon Spy for the `processFile()` method
   * @returns {Array}
   */
  getFiles (spy) {
    return utils.getCallArg(spy, 0);
  },


  /**
   * Returns the file path from each `processFile()` call.
   *
   * @param spy {SinonSpy} - A Sinon Spy for the `processFile()` method
   * @returns {string[]}
   */
  getFilePaths (spy) {
    return utils.getFiles(spy).map((file) => file.path);
  },


  /**
   * Iterates over all items in an async iterable and returns them as an array.
   *
   * This is a workaround for the lack of an async spread operator and/or support for async iterables
   * in `Promise.all()`.
   *
   * @see https://github.com/tc39/proposal-async-iteration/issues/103
   */
  async iterateAll (iterable) {
    let items = [];
    for await (let item of iterable) {
      items.push(item);
    }

    return items;
  },


  /**
   * Ensures that tests work consistently on both the main thread and worker threads.
   * The test suite calls the `createModule()` function that's passed to it rather than the normal
   * `utils.createModule()` method, so every plugin is authored as though it was a worker plugin.
   */
  testThreadConsistency (testSuite) {
    describe("Main Thread", () => testSuite(createMainThreadModule));
    describe("Worker Thread", () => testSuite(createWorkerThreadModule));
  },


  /**
   * Creates a worker module that exports the given plugin method, optionally accepting the given data.
   *
   * @param code {function|string} - The module's source code
   */
  async createModule (code) {
    // Create a temp file
    let moduleId = await new Promise((resolve, reject) =>
      tmp.file({ prefix: "code-engine-", postfix: ".js" }, (e, p) => e ? reject(e) : resolve(p)));

    if (typeof code !== "string") {
      code = `"use strict";\nmodule.exports = ${code};`;
    }

    await fs.writeFile(moduleId, code);

    return moduleId;
  },
};


/**
 * Runs the given plugin method on the main thread
 */
async function createMainThreadModule (method, data) {
  if (data !== undefined) {
    method = method(data);
  }
  return method;
}


/**
 * Runs the given plugin method on a worker thread
 */
async function createWorkerThreadModule (method, data) {
  let moduleId = await utils.createModule(method);
  return { moduleId, data };
}
