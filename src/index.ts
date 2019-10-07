import { CodeEngine } from "./code-engine";

export * from "@code-engine/types";
export { BuildSummary } from "./build/build-summary";
export { Config } from "./config";
export { CodeEngine };

// Export `CodeEngine` as the default export
// tslint:disable: no-default-export
export default CodeEngine;

// CommonJS default export hack
if (typeof module === "object" && typeof module.exports === "object") {
  module.exports = Object.assign(module.exports.default, module.exports);  // tslint:disable-line: no-unsafe-any
}
