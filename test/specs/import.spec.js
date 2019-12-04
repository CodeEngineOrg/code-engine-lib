"use strict";

const CodeEngine = require("../../lib");
const { getFiles, createModule } = require("../utils");
const { assert, expect } = require("chai");
const sinon = require("sinon");

describe("CodeEngine.import()", () => {

  it("should import a module in worker threads", async () => {
    let source = {
      read () {
        return { path: "file.txt" };
      },
    };

    let processor = await createModule((file) => {
      file.text = global.text;
      return file;
    });

    let module = await createModule("global.text = 'This text came from the module';");

    let spy = sinon.spy();

    let engine = new CodeEngine();
    await engine.import(module);
    await engine.use(source, processor, spy);
    await engine.build();

    sinon.assert.calledOnce(spy);
    let file = getFiles(spy)[0];
    expect(file.text).to.equal("This text came from the module");
  });

  it("should call the module's factory function, even with no data", async () => {
    let source = {
      read () {
        return { path: "file.txt" };
      },
    };

    let processor = await createModule((file) => {
      file.text = global.text;
      return file;
    });

    let module = await createModule(() => global.text = "This text was set by the factory function");

    let spy = sinon.spy();

    let engine = new CodeEngine();
    await engine.import(module);
    await engine.use(source, processor, spy);
    await engine.build();

    sinon.assert.calledOnce(spy);
    let file = getFiles(spy)[0];
    expect(file.text).to.equal("This text was set by the factory function");
  });

  it("should call the module's factory function with data", async () => {
    let source = {
      read () {
        return { path: "file.txt" };
      },
    };

    let processor = await createModule((file) => {
      file.text = global.text;
      return file;
    });

    let module = await createModule(
      (data) => global.text = data.text,
      { text: "This text came from the data object" }
    );

    let spy = sinon.spy();

    let engine = new CodeEngine();
    await engine.import(module);
    await engine.use(source, processor, spy);
    await engine.build();

    sinon.assert.calledOnce(spy);
    let file = getFiles(spy)[0];
    expect(file.text).to.equal("This text came from the data object");
  });

  it("should wait for an async factory function to finish", async () => {
    let source = {
      read () {
        return { path: "file.txt" };
      },
    };

    let processor = await createModule((file) => {
      file.text = global.text;
      return file;
    });

    let module = await createModule(
      async (data) => {
        await new Promise((resolve) => setTimeout(resolve, data.delay));
        global.text = data.text;
      },
      {
        delay: 300,
        text: "This text was set asynchronously"
      }
    );

    let spy = sinon.spy();

    let engine = new CodeEngine();
    await engine.import(module);
    await engine.use(source, processor, spy);
    await engine.build();

    sinon.assert.calledOnce(spy);
    let file = getFiles(spy)[0];
    expect(file.text).to.equal("This text was set asynchronously");
  });

  it("should throw an error if the module has errors", async () => {
    let module = await createModule("hello world");
    let engine = new CodeEngine();

    try {
      await engine.import(module);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(SyntaxError);
      expect(error.message).to.equal(`Error importing module: ${module} \nUnexpected identifier`);
    }
  });

  it("should re-throw errors from the factory function", async () => {
    let module = await createModule(() => {
      throw new RangeError("Boom!");
    });
    let engine = new CodeEngine();

    try {
      await engine.import(module);
      assert.fail("An error should have been thrown");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(RangeError);
      expect(error.message).to.equal(`Error importing module: ${module} \nBoom!`);
    }
  });

});
