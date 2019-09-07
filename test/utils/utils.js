"use strict";

/** @typedef { import("sinon").SinonSpy } SinonSpy */
/** @typedef { import("sinon").SinonSpyCall } SinonSpyCall */
const tmp = require("tmp");
const { promises: fs } = require("fs");

// Gracefully cleanup temp files
tmp.setGracefulCleanup();

module.exports = {
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


  /**
   * Asserts the given Sinon calls were called in the given order.
   *
   * @param calls {...SinonSpyCall} - The Sinon calls to check the order of
   */
  assertCallOrder (...calls) {
    let actualOrder = calls.slice().sort((a, b) => {
      return a.callId - b.callId;
    });

    for (let i = 1; i < calls.length; i++) {
      let expected = calls[i];
      let actual = actualOrder[i];

      if (actual !== expected) {
        throw new Error(
          "Incorrect call order. Actual order was:\n  " +
          actualOrder.map((call) => `${call.proxy.displayName}(${call.args[0]})`).join("\n  ")
        );
      }
    }
  },
};
