"use strict";

const { CodeEngine } = require("../../");
const { delay } = require("../utils");
const { assert, expect } = require("chai");

describe("CodeEngine class", () => {

  function isCodeEngine (engine) {
    expect(engine).to.be.an.instanceOf(CodeEngine);
    expect(engine.cwd).to.be.a("string").with.length.of.at.least(1);
    expect(engine.concurrency).to.be.a("number").above(0);
    expect(engine.debug).to.be.a("boolean");
    expect(engine.dev).to.be.a("boolean");
    expect(engine.log).to.be.a("function");
    return true;
  }

  it("should work without any arguments", async () => {
    let engine = new CodeEngine();
    expect(engine).to.satisfy(isCodeEngine);
  });

  it("should work with an empty configuration", async () => {
    let engine = new CodeEngine({});
    expect(engine).to.satisfy(isCodeEngine);
  });

  it("should ignore unknown configuration properties", async () => {
    let engine = new CodeEngine({ foo: true, bar: 5 });
    expect(engine).to.satisfy(isCodeEngine);
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
    let engine = new CodeEngine();

    expect(Object.prototype.toString.call(engine)).to.equal("[object CodeEngine]");
    expect(engine.toString()).to.equal("CodeEngine (0 plugins)");

    await engine.use({ name: "Plugin 1", read () {} });
    expect(Object.prototype.toString.call(engine)).to.equal("[object CodeEngine]");
    expect(engine.toString()).to.equal("CodeEngine (1 plugins)");

    await engine.use({ name: "Plugin 2", read () {} }, { name: "Plugin 3", read () {} });
    expect(Object.prototype.toString.call(engine)).to.equal("[object CodeEngine]");
    expect(engine.toString()).to.equal("CodeEngine (3 plugins)");

    await engine.dispose();
    expect(Object.prototype.toString.call(engine)).to.equal("[object CodeEngine]");
    expect(engine.toString()).to.equal("CodeEngine (disposed)");
  });

  it("should throw an error for invalid plugins", async () => {
    let engine = new CodeEngine();

    let invalidPlugins = [
      12345, true, false, -1, {}, { name: "My Plugin" }, { foo: "bar" }, { read: true },
      { processFiles: {}}, { read () {}, processFile: {}}, { read () {}, processFile: 123 },
    ];

    for (let invalidPlugin of invalidPlugins) {
      try {
        await engine.use(invalidPlugin);
        assert.fail(`CodeEngine should have thrown an error for ${invalidPlugin}`);
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error.message).to.match(/^Error in Plugin \d\. \nInvalid CodeEngine plugin: /);
      }
    }
  });

  it("should be removed from the instances array when disposed", async () => {
    let engine1 = new CodeEngine();
    expect(CodeEngine.instances).to.deep.equal([engine1]);

    let engine2 = new CodeEngine();
    expect(CodeEngine.instances).to.deep.equal([engine1, engine2]);

    let engine3 = new CodeEngine();
    expect(CodeEngine.instances).to.deep.equal([engine1, engine2, engine3]);

    let dispose = engine2.dispose();
    expect(CodeEngine.instances).to.deep.equal([engine1, engine3]);
    await dispose;

    dispose = engine1.dispose();
    expect(CodeEngine.instances).to.deep.equal([engine3]);
    await dispose;

    dispose = engine3.dispose();
    expect(CodeEngine.instances).to.have.lengthOf(0);
    await dispose;
  });

  it("should ignore multiple dispose() calls", async () => {
    let engine1 = new CodeEngine();
    let engine2 = new CodeEngine();
    let engine3 = new CodeEngine();

    expect(CodeEngine.instances).to.deep.equal([engine1, engine2, engine3]);

    await engine2.dispose();
    expect(CodeEngine.instances).to.deep.equal([engine1, engine3]);

    await engine2.dispose();
    expect(CodeEngine.instances).to.deep.equal([engine1, engine3]);

    await engine3.dispose();
    expect(CodeEngine.instances).to.deep.equal([engine1]);

    await engine3.dispose();
    expect(CodeEngine.instances).to.deep.equal([engine1]);

    await engine1.dispose();
    expect(CodeEngine.instances).to.have.lengthOf(0);

    await engine1.dispose();
    expect(CodeEngine.instances).to.have.lengthOf(0);
  });

  it("should ignore multiple dispose() calls", async () => {
    let engine = new CodeEngine();
    expect(engine.disposed).to.equal(false);
    expect(CodeEngine.instances).to.have.lengthOf(1);

    await engine.dispose();
    expect(engine.disposed).to.equal(true);
    expect(CodeEngine.instances).to.have.lengthOf(0);

    await engine.dispose();
    expect(engine.disposed).to.equal(true);
    expect(CodeEngine.instances).to.have.lengthOf(0);
  });

  it("should throw an error if used after dispose()", async () => {
    let engine = new CodeEngine();
    await engine.dispose();

    try {
      await engine.use({ name: "Plugin" });
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("CodeEngine cannot be used after it has been disposed.");
    }

    try {
      await engine.clean();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("CodeEngine cannot be used after it has been disposed.");
    }

    try {
      await engine.run();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("CodeEngine cannot be used after it has been disposed.");
    }
  });

  it("should re-throw synchronous errors that occur during dispose()", async () => {
    let badPlugin = {
      dispose () {
        throw new RangeError("Boom!");
      }
    };

    let engine = new CodeEngine();
    await engine.use(badPlugin);

    try {
      await engine.dispose();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal("An error occurred in Plugin 1 while cleaning-up. \nBoom!");
    }
  });

  it("should re-throw asynchronous errors that occur during dispose()", async () => {
    let badPlugin = {
      async dispose () {
        await delay(100);
        throw new RangeError("Boom!");
      }
    };

    let engine = new CodeEngine();
    await engine.use(badPlugin);

    try {
      await engine.dispose();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal("An error occurred in Plugin 1 while cleaning-up. \nBoom!");
    }
  });

});
