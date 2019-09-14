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
   * The test suite calls the `createPlugin()` helper function to create a plugin without knowing
   * whether the plugin will run on the main thread or a worker thread.
   */
  testThreadConsistency (testSuite) {
    describe("Main Thread", () => testSuite(createMainThreadPlugin));
    describe("Worker Thread", () => testSuite(createWorkerThreadPlugin));
  },


  /**
   * Creates a temporary JavaScript file with the given name and contents.
   * This is for testing the worker thread functionality of CodeEngine.
   *
   * @param contents {string} - The JavaScript code
   * @returns {string} - The absolute path of the module
   */
  async createModule (contents) {
    let path = await new Promise((resolve, reject) =>
      tmp.file({ prefix: "code-engine-", postfix: ".js" }, (e, p) => e ? reject(e) : resolve(p)));
    await fs.writeFile(path, contents);
    return path;
  },
};


/**
 * Creates a CodeEngine plugin that runs on the main thread.
 */
async function createMainThreadPlugin (pluginFactory, data) {
  // Create the plugin on the main thread (this thread)
  return pluginFactory(data);
}


/**
 * Creates a CodeEngine plugin that runs on a worker thread.
 */
async function createWorkerThreadPlugin (pluginFactory, data) {
  let moduleId = await utils.createModule(`module.exports = ${pluginFactory.toString()};`);
  return { moduleId, data };
}
