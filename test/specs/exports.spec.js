"use strict";

const commonJSExport = require("../../");
const { default: defaultExport, CodeEngine: namedExport, env, Events } = require("../../");
const { expect } = require("chai");

describe("@code-engine/lib package exports", () => {

  it("should export the CodeEngine class as the default CommonJS export", () => {
    expect(commonJSExport).to.be.a("function");
    expect(commonJSExport.name).to.equal("CodeEngine");
  });

  it("should export the CodeEngine class as the default ESM export", () => {
    expect(defaultExport).to.be.a("function");
    expect(defaultExport).to.equal(commonJSExport);
  });

  it("should export the CodeEngine class as a named export", () => {
    expect(namedExport).to.be.a("function");
    expect(namedExport).to.equal(commonJSExport);
  });

  it("should export the env object as a named export", () => {
    expect(env).to.be.an("object");
    expect(env).to.have.keys("isDev", "isDebug", "isWindows");
  });

  it("should export the Events enumeration as a named export", () => {
    expect(Events).to.be.an("object");
    expect(Events).to.have.keys("Error", "Log");
  });

  it("should not export anything else", () => {
    expect(commonJSExport).to.have.keys(
      "default",
      "CodeEngine",
      "env",
      "Events",
    );
  });

});
