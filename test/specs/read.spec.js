"use strict";

const path = require("path");
const sinon = require("sinon");
const CodeEngine = require("../utils/code-engine");
const { delay, getCallArg } = require("../utils/utils");
const { assert, expect } = require("chai");

describe("Plugin.read()", () => {

  it("should call the read() method of all plugins", async () => {
    let plugin1 = { read: sinon.stub().returns([]) };
    let plugin2 = { read: sinon.stub().returns([]) };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    let summary = await engine.build();

    sinon.assert.calledOnce(plugin1.read);
    sinon.assert.calledOnce(plugin2.read);
    expect(summary.fileCount).to.equal(0);
  });

  it("should iterate over all files from all sources of different types", async () => {
    let iterable = {
      read () {
        return [
          { path: "file1.txt" },
          { path: "file2.txt" },
        ];
      }
    };
    let iterator = {
      read () {
        let files = [
          { path: "file3.txt" },
          { path: "file4.txt" },
        ];
        let iter = files[Symbol.iterator]();
        iter[Symbol.iterator] = undefined;
        return iter;
      }
    };
    let generator = {
      *read () {
        yield { path: "file5.txt" };
        yield { path: "file6.txt" };
      }
    };
    let asyncGenerator = {
      async *read () {
        await delay(50);
        yield { path: "file7.txt" };
        await delay(50);
        yield { path: "file8.txt" };
      }
    };

    let spy = sinon.spy();

    let engine = CodeEngine.create();
    await engine.use(iterable, iterator, generator, asyncGenerator, spy);
    await engine.build();

    sinon.assert.callCount(spy, 8);
    let filePaths = getCallArg(spy).map((file) => file.path);
    expect(filePaths).to.have.same.members([
      "file1.txt",
      "file2.txt",
      "file3.txt",
      "file4.txt",
      "file5.txt",
      "file6.txt",
      "file7.txt",
      "file8.txt",
    ]);
  });

  it("should iterate files in first-come order", async () => {
    let plugin1 = {
      async *read () {
        await delay(50);
        yield { path: "file1.txt" };
        await delay(100);
        yield { path: "file2.txt" };
      }
    };
    let plugin2 = {
      async *read () {
        yield { path: "file3.txt" };
        await delay(25);
        yield { path: "file4.txt" };
        await delay(50);
        yield { path: "file5.txt" };
      },
    };

    let spy = sinon.spy();

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2, spy);
    await engine.build();

    sinon.assert.callCount(spy, 5);
    let files = getCallArg(spy);
    expect(files[0]).to.have.property("path", "file3.txt");
    expect(files[1]).to.have.property("path", "file4.txt");
    expect(files[2]).to.have.property("path", "file1.txt");
    expect(files[3]).to.have.property("path", "file5.txt");
    expect(files[4]).to.have.property("path", "file2.txt");
  });

  it("should allow multiple files to have the same path", async () => {
    let plugin = {
      name: "Plugin",
      read () {
        return [
          { path: "file1.txt" },
          { path: "path/to/file1.txt" },
          { path: "path/to/another/file1.txt" },
          { path: "path/to/another/file1.txt" },
          { path: "path/to/file1.txt" },
          { path: "file1.txt" },
        ];
      }
    };

    let spy = sinon.spy();

    let engine = CodeEngine.create();
    await engine.use(plugin, spy);
    await engine.build();

    sinon.assert.callCount(spy, 6);
    let files = getCallArg(spy);
    expect(files[0]).to.have.property("path", "file1.txt");
    expect(files[1]).to.have.property("path", path.normalize("path/to/file1.txt"));
    expect(files[2]).to.have.property("path", path.normalize("path/to/another/file1.txt"));
    expect(files[3]).to.have.property("path", path.normalize("path/to/another/file1.txt"));
    expect(files[4]).to.have.property("path", path.normalize("path/to/file1.txt"));
    expect(files[5]).to.have.property("path", "file1.txt");
  });

  it("should allow multiple sources to return files with the same path", async () => {
    let plugin1 = {
      read () {
        return [
          { path: "file1.txt" },
          { path: "file2.txt" },
          { path: "file3.txt" },
        ];
      }
    };
    let plugin2 = {
      read () {
        return [
          { path: "file1.txt" },
          { path: "file2.txt" },
          { path: "file3.txt" },
        ];
      }
    };

    let spy = sinon.spy();

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2, spy);
    await engine.build();

    sinon.assert.callCount(spy, 6);
    let files = getCallArg(spy);
    expect(files[0]).to.have.property("path", "file1.txt");
    expect(files[1]).to.have.property("path", "file1.txt");
    expect(files[2]).to.have.property("path", "file2.txt");
    expect(files[3]).to.have.property("path", "file2.txt");
    expect(files[4]).to.have.property("path", "file3.txt");
    expect(files[5]).to.have.property("path", "file3.txt");
  });

  it("should ignore unknown fields on FileInfo objects", async () => {
    const expectedKeys = ["source", "path", "createdAt", "modifiedAt", "metadata", "contents"];

    let plugin = {
      name: "Plugin",
      *read () {
        yield { path: "file1.txt", foo: 123 };
        yield { path: "file2.txt", bar: 456 };
        yield { path: "file3.txt", hello: "world" };
      },
    };

    let spy = sinon.spy();

    let engine = CodeEngine.create();
    await engine.use(plugin, spy);
    await engine.build();

    sinon.assert.calledThrice(spy);
    let processFile = spy.getCalls();
    expect(processFile[0].args[0]).to.satisfy(validateFileProps);
    expect(processFile[1].args[0]).to.satisfy(validateFileProps);
    expect(processFile[2].args[0]).to.satisfy(validateFileProps);

    function validateFileProps (file) {
      expect(file).to.be.a("File").with.keys(expectedKeys);
      expect(file.metadata).to.be.an("object").and.empty;
      return true;
    }
  });

  it("should process an empty set if there are no plugins", async () => {
    let engine = CodeEngine.create();
    let summary = await engine.build();
    expect(summary.fileCount).to.equal(0);
    expect(summary.totalFileSize).to.equal(0);
  });

  it("should process an empty set if there are no file sources", async () => {
    let plugin1 = { clean: sinon.spy() };
    let plugin2 = { watch: sinon.spy() };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    let summary = await engine.build();

    expect(summary.fileCount).to.equal(0);
    expect(summary.totalFileSize).to.equal(0);

    sinon.assert.notCalled(plugin1.clean);
    sinon.assert.notCalled(plugin2.watch);
  });

  it("should throw an error if a plugin's read() method returns a non-iterable value", async () => {
    let plugin = {
      read () {
        return 42;
      }
    };

    let engine = CodeEngine.create();
    await engine.use(plugin);

    try {
      await engine.build();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal(
        "An error occurred in Plugin 1 while reading source files. \n" +
        "Invalid CodeEngine file: 42. Expected an object with at least a \"path\" property."
      );
    }
  });

});
