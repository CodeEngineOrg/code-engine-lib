"use strict";

const commonJSExport = require("../../");
const { default: defaultExport, CodeEngine: namedExport, Event, LogLevel } = require("../../");
const { expect } = require("chai");

describe.only("@code-engine/lib package exports", () => {

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

  it("should export the Events enumeration as a named export", () => {
    expect(Event).to.be.an("object");
    expect(Event).to.have.keys("Error", "Log");
  });

  it("should export the LogLevel enumeration as a named export", () => {
    expect(LogLevel).to.be.an("object");
    expect(LogLevel).to.have.keys("Debug", "Info", "Warning", "Error");
  });

  it("should not export anything else", () => {
    expect(commonJSExport).to.have.keys(
      "default",
      "CodeEngine",
      "Event",
      "LogLevel",
    );
  });

});
