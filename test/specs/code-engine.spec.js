"use strict";

const { CodeEngine } = require("../../lib");
const { assert, expect } = require("chai");

describe("CodeEngine class", () => {

  it("should work without any arguments", async () => {
    let engine;

    try {
      engine = new CodeEngine();
      expect(engine).to.be.a("CodeEngine");
    }
    finally {
      engine && await engine.dispose();
    }
  });

  it("should work with an empty configuration", async () => {
    let engine;

    try {
      engine = new CodeEngine({});
      expect(engine).to.be.a("CodeEngine");
    }
    finally {
      engine && await engine.dispose();
    }
  });

  it("should ignore unknown configuration properties", async () => {
    let engine;

    try {
      engine = new CodeEngine({ foo: true, bar: 5 });
      expect(engine).to.be.a("CodeEngine");
    }
    finally {
      engine && await engine.dispose();
    }
  });

  it('should not work without the "new" keyword', () => {
    function withoutNew () {
      // eslint-disable-next-line new-cap
      return CodeEngine();
    }

    expect(withoutNew).to.throw(TypeError);
    expect(withoutNew).to.throw("Class constructor CodeEngine cannot be invoked without 'new'");
  });

  it("should support toString()", async () => {
    let engine;

    try {
      engine = new CodeEngine();
      expect(Object.prototype.toString.call(engine)).to.equal("[object CodeEngine]");
      expect(engine.toString()).to.equal("CodeEngine (0 plugins)");

      await engine.use({ name: "Plugin 1" });
      expect(Object.prototype.toString.call(engine)).to.equal("[object CodeEngine]");
      expect(engine.toString()).to.equal("CodeEngine (1 plugins)");

      await engine.use({ name: "Plugin 2" }, { name: "Plugin 3" });
      expect(Object.prototype.toString.call(engine)).to.equal("[object CodeEngine]");
      expect(engine.toString()).to.equal("CodeEngine (3 plugins)");
    }
    finally {
      engine && await engine.dispose();
      expect(Object.prototype.toString.call(engine)).to.equal("[object CodeEngine]");
      expect(engine.toString()).to.equal("CodeEngine (disposed)");
    }
  });

  it("should ignore multiple dispose() calls", async () => {
    let engine = new CodeEngine();
    expect(engine.isDisposed).to.be.false;
    await engine.dispose();
    expect(engine.isDisposed).to.be.true;
    await engine.dispose();
    expect(engine.isDisposed).to.be.true;
  });

  it("should throw an error if used after dispose()", async () => {
    let engine = new CodeEngine();
    await engine.dispose();

    try {
      await engine.use({ moduleId: "some-file.js" });
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("CodeEngine cannot be used after it has been disposed.");
    }
  });

});
