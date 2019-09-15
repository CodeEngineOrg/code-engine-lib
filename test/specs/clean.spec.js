"use strict";

const CodeEngine = require("../utils/code-engine");
const sinon = require("sinon");
const { assert, expect } = require("chai");

describe("Plugin.clean()", () => {

  it("should do nothing if there are no plugins", async () => {
    let engine = CodeEngine.create();
    await engine.clean();
  });

  it("should do nothing if there are no plugins that implement clean()", async () => {
    let engine = CodeEngine.create();
    await engine.use({ name: "Some Plugin", find () {} });
    await engine.clean();
  });

  it("should call the clean() method of all plugins", async () => {
    let plugin1 = { clean: sinon.spy() };
    let plugin2 = { clean: sinon.spy() };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    await engine.clean();

    sinon.assert.calledOnce(plugin1.clean);
    sinon.assert.calledOnce(plugin2.clean);
  });

  it("should support asynchronous plugins", async () => {
    let plugin1 = { clean: sinon.stub().returns(Promise.resolve()) };
    let plugin2 = { clean: sinon.stub().returns(Promise.resolve()) };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    await engine.clean();

    sinon.assert.calledOnce(plugin1.clean);
    sinon.assert.calledOnce(plugin2.clean);
  });

  it("should re-throw synchronous errors", async () => {
    let plugin1 = { clean: sinon.stub().returns(1) };
    let plugin2 = { clean: sinon.spy(() => { throw new SyntaxError("Boom!"); }) };
    let plugin3 = { clean: sinon.stub().returns(2) };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2, plugin3);

    try {
      await engine.clean();
      assert.fail("CodeEngine should have re-thrown the Promise failure.");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("Boom!");
    }

    sinon.assert.calledOnce(plugin1.clean);
    sinon.assert.calledOnce(plugin2.clean);
    sinon.assert.notCalled(plugin3.clean);
  });

  it("should re-throw asynchronous errors", async () => {
    let plugin1 = { name: "Plugin 1", clean: sinon.stub().returns(Promise.resolve()) };
    let plugin2 = { name: "Plugin 2", clean: sinon.stub().returns(Promise.reject("Boom!")) };
    let plugin3 = { name: "Plugin 2", clean: sinon.stub().returns(Promise.resolve()) };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2, plugin3);

    try {
      await engine.clean();
      assert.fail("CodeEngine should have re-thrown the Promise failure.");
    }
    catch (error) {
      expect(error).to.equal("Boom!");
    }

    sinon.assert.calledOnce(plugin1.clean);
    sinon.assert.calledOnce(plugin2.clean);
    sinon.assert.calledOnce(plugin3.clean);
  });

});
