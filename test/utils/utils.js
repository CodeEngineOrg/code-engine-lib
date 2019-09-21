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
  async delay (timeout, result) {
    await new Promise((resolve) => setTimeout(() => resolve(result), timeout));
  },


  /**
   * Ensures that tests work consistently on both the main thread and worker threads.
   * The test suite calls the `createModule()` function that's passed to it rather than the normal
   * `utils.createModule()` method, so every plugin is authored as though it was a worker plugin.
   */
  testThreadConsistency (testSuite) {
    describe("Main Thread", () => testSuite(createMainThreadModule));
    describe("Worker Thread", () => testSuite(utils.createModule));
  },


  /**
   * Creates a worker module that exports the given plugin method, optionally accepting the given data.
   *
   * @param method {function} - The plugin method to return in the module
   * @param [data] {object} - The data (if any) to make available to the plugin method
   * @returns {string|object} - A CodeEngine worker module
   */
  async createModule (method, data) {
    // Create a temp file
    let moduleId = await new Promise((resolve, reject) =>
      tmp.file({ prefix: "code-engine-", postfix: ".js" }, (e, p) => e ? reject(e) : resolve(p)));

    await fs.writeFile(moduleId, `module.exports = ${method};`);
    return { moduleId, data };
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
