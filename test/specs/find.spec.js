"use strict";

const path = require("path");
const sinon = require("sinon");
const CodeEngine = require("../utils/code-engine");
const { delay } = require("../utils/utils");
const { assert, expect } = require("chai");

describe("Plugin.find()", () => {

  it("should call the find() method of all plugins", async () => {
    let plugin1 = { name: "Plugin 1", find: sinon.stub().returns([]) };
    let plugin2 = { name: "Plugin 2", find: sinon.stub().returns([]) };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    let files = await engine.build();

    sinon.assert.calledOnce(plugin1.find);
    sinon.assert.calledOnce(plugin2.find);
    expect(files.size).to.equal(0);
  });

  it("should iterate over all files from all sources", async () => {
    let plugin1 = {
      name: "Plugin 1",
      find () {
        return [
          { path: "file1.txt" },
          { path: "file2.txt" },
        ];
      }
    };
    let plugin2 = {
      name: "Plugin 2",
      *find () {
        yield { path: "file3.txt" };
        yield { path: "file4.txt" };
      }
    };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    let files = await engine.build();

    expect(files.size).to.equal(4);
    expect([...files.keys()]).to.have.same.members([
      "file1.txt",
      "file2.txt",
      "file3.txt",
      "file4.txt",
    ]);
  });

  it("should iterate files in first-come order", async () => {
    let plugin1 = {
      name: "Plugin 1",
      async *find () {
        await delay(50);
        yield { path: "file1.txt" };
        await delay(100);
        yield { path: "file2.txt" };
      }
    };
    let plugin2 = {
      name: "Plugin 2",
      async *find () {
        yield { path: "file3.txt" };
        await delay(25);
        yield { path: "file4.txt" };
        await delay(50);
        yield { path: "file5.txt" };
      },
      processFile: sinon.spy()
    };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    let files = await engine.build();

    expect(files.size).to.equal(5);
    sinon.assert.callCount(plugin2.processFile, 5);

    let processFile = plugin2.processFile.getCalls();
    expect(processFile[0].args[0]).to.be.a("File").with.property("path", "file3.txt");
    expect(processFile[1].args[0]).to.be.a("File").with.property("path", "file4.txt");
    expect(processFile[2].args[0]).to.be.a("File").with.property("path", "file1.txt");
    expect(processFile[3].args[0]).to.be.a("File").with.property("path", "file5.txt");
    expect(processFile[4].args[0]).to.be.a("File").with.property("path", "file2.txt");
  });

  it("should ignore unknown fields on FileInfo objects", async () => {
    const expectedKeys = ["dir", "extension", "createdAt", "modifiedAt", "metadata", "contents"];

    let plugin = {
      name: "Plugin",
      *find () {
        yield { path: "file1.txt", foo: 123 };
        yield { path: "file2.txt", bar: 456 };
        yield { path: "file3.txt", hello: "world" };
      },
      processFile: sinon.spy(),
    };

    let engine = CodeEngine.create();
    await engine.use(plugin);
    let files = await engine.build();

    expect(files.size).to.equal(3);
    files.forEach(validateFileProps);

    sinon.assert.calledThrice(plugin.processFile);
    let processFile = plugin.processFile.getCalls();
    expect(processFile[0].args[0]).to.satisfy(validateFileProps);
    expect(processFile[1].args[0]).to.satisfy(validateFileProps);
    expect(processFile[2].args[0]).to.satisfy(validateFileProps);

    function validateFileProps (file) {
      expect(file).to.be.a("File").with.keys(expectedKeys);
      expect(file.metadata).to.be.an("object").and.empty;
      return true;
    }
  });

  it("should throw an error if there are no plugins", async () => {
    try {
      let engine = CodeEngine.create();
      await engine.build();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("At least one file source is required.");
    }
  });

  it("should throw an error if there are no file sources", async () => {
    let plugin1 = { name: "Plugin 1", clean: sinon.spy() };
    let plugin2 = { name: "Plugin 2", watch: sinon.spy() };

    try {
      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2);
      await engine.build();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error).to.be.an.instanceOf(Error);
      expect(error.message).to.equal("At least one file source is required.");
    }

    sinon.assert.notCalled(plugin1.clean);
    sinon.assert.notCalled(plugin2.watch);
  });

  it("should throw an error if a plugin's find() method returns a non-iterable value", async () => {
    let plugin = {
      name: "Plugin",
      find () {
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
      expect(error).to.be.an.instanceOf(TypeError);
      expect(error.message).to.equal("CodeEngine requires an iterable, such as an array, Map, Set, or generator.");
    }
  });

  it("should throw an error if multiple files have the same path", async () => {
    let plugin = {
      name: "Plugin",
      find () {
        return [
          { path: "file1.txt" },
          { path: "path/to/file1.txt" },
          { path: "path/to/file1.html" },
          { path: "path/to/another/file1.txt" },
          { path: "path/to/another/file1.xml" },
          { path: "path/to/file1.txt" },
        ];
      }
    };

    let engine = CodeEngine.create();
    await engine.use(plugin);

    try {
      await engine.build();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error.message).to.equal("Duplicate file path: " + path.normalize("path/to/file1.txt"));
    }
  });

  it("should throw an error if multiple sources return files with the same path", async () => {
    let plugin1 = {
      name: "Plugin 1",
      find () {
        return [
          { path: "file1.txt" },
          { path: "file2.txt" },
          { path: "file3.txt" },
        ];
      }
    };
    let plugin2 = {
      name: "Plugin 2",
      find () {
        return [
          { path: "file4.txt" },
          { path: "file2.txt" },
          { path: "file5.txt" },
        ];
      }
    };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);

    try {
      await engine.build();
      assert.fail("CodeEngine should have thrown an error");
    }
    catch (error) {
      expect(error.message).to.equal("Duplicate file path: file2.txt");
    }
  });

});
