"use strict";

const { CodeEngine } = require("../../");

// Keeps track of the CodeEngine instances that are created during a test.
// This allows us to dispose of them all after each test.
let instances = [];

module.exports = {
  /**
   * Creates a new CodeEngine instance
   */
  create (config) {
    let engine = new CodeEngine(config);
    instances.push(engine);
    return engine;
  },

  /**
   * Dispose all CodeEngine instances
   */
  async disposeAll () {
    await Promise.all(instances.map((engine) => engine.dispose()));
    instances = [];
  }
};
