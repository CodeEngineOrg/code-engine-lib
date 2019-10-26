"use strict";

const CodeEngine = require("../utils/code-engine");
const { getCallArg, testThreadConsistency } = require("../utils/utils");
const { assert, expect } = require("chai");
const sinon = require("sinon");
const path = require("path");

describe("Plugin.processFiles()", () => {
  testThreadConsistency((createModule) => {

    it("should not output any files if processFiles() returns nothing", async () => {
      let source = {
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        }
      };
      let plugin = {
        processFiles: sinon.spy(),
      };
      let spy = sinon.spy();

      let engine = CodeEngine.create();
      await engine.use(source, plugin, spy);
      await engine.build();

      sinon.assert.calledOnce(plugin.processFiles);
      sinon.assert.notCalled(spy);
    });

    it("should output a subset of files", async () => {
      let source = {
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        }
      };
      let plugin = {
        async* processFiles (files) {
          for await (let file of files) {
            if (["file1.txt", "file3.txt"].includes(file.name)) {
              yield file;
            }
          }
        }
      };
      let spy = sinon.spy();

      let engine = CodeEngine.create();
      await engine.use(source, plugin, spy);
      await engine.build();

      sinon.assert.calledTwice(spy);
      let files = getCallArg(spy);
      expect(files).to.have.lengthOf(2);
      expect(files[0].name).to.equal("file1.txt");
      expect(files[1].name).to.equal("file3.txt");
    });

    it("should output a superset of files", async () => {
      let source = {
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        }
      };
      let plugin = {
        async* processFiles (files) {
          yield* await files.all();
          yield { path: "file4.txt" };
          yield { path: "file5.txt" };
        }
      };
      let spy = sinon.spy();

      let engine = CodeEngine.create();
      await engine.use(source, plugin, spy);
      await engine.build();

      sinon.assert.callCount(spy, 5);
      let files = getCallArg(spy);
      expect(files).to.have.lengthOf(5);
      expect(files[0].name).to.equal("file1.txt");
      expect(files[1].name).to.equal("file2.txt");
      expect(files[2].name).to.equal("file3.txt");
      expect(files[3].name).to.equal("file4.txt");
      expect(files[4].name).to.equal("file5.txt");
    });

    it("should call the processFiles() method of all plugins", async () => {
      let plugin1 = {
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        },
        processFiles: sinon.stub().returnsArg(0),
      };
      let plugin2 = {
        processFiles: sinon.stub().returnsArg(0)
      };
      let spy = sinon.spy();

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2, spy);
      await engine.build();

      sinon.assert.calledOnce(plugin1.processFiles);
      sinon.assert.calledOnce(plugin2.processFiles);
      sinon.assert.callCount(spy, 3);

      let files = getCallArg(spy);
      expect(files).to.have.lengthOf(3);
      expect(files[0].name).to.equal("file1.txt");
      expect(files[1].name).to.equal("file2.txt");
      expect(files[2].name).to.equal("file3.txt");
    });

    it("should call the processFiles() method of all plugins, even if there are no files", async () => {
      let plugin1 = {
        processFiles: sinon.stub().returnsArg(0),
      };
      let plugin2 = {
        processFiles: sinon.stub().returnsArg(0)
      };
      let spy = sinon.spy();

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2, spy);
      await engine.build();

      sinon.assert.calledOnce(plugin1.processFiles);
      sinon.assert.calledOnce(plugin2.processFiles);
      sinon.assert.notCalled(spy);
    });

    it("should call the processFiles() method of all plugins, even if files are suppressed by a previous plugin", async () => {
      let source = {
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        },
      };
      let plugin1 = await createModule(() => undefined);
      let plugin2 = {
        processFiles: sinon.stub().returnsArg(0)
      };
      let plugin3 = {
        processFiles: sinon.stub().returnsArg(0)
      };
      let spy = sinon.spy();

      let engine = CodeEngine.create();
      await engine.use(source, plugin1, plugin2, plugin3, spy);
      await engine.build();

      sinon.assert.calledOnce(plugin2.processFiles);
      sinon.assert.calledOnce(plugin3.processFiles);
      sinon.assert.notCalled(spy);
    });

    it("should only pass the files to each plugin that match its filter", async () => {
      let plugin1 = {
        *read () {
          yield { path: "file.txt" };
          yield { path: "file.html" };
          yield { path: "subdir/file.txt" };
          yield { path: "subdir/file.html" };
          yield { path: "subdir/subsubdir/file.txt" };
          yield { path: "subdir/subsubdir/file.html" };
        },
        filter: true,
        async* processFiles (files) {
          for await (let file of files) {
            file.text += "1";
            yield file;
          }
        },
      };
      let plugin2 = {
        filter: false,
        async* processFiles (files) {
          for await (let file of files) {
            file.text += "2";
            yield file;
          }
        }
      };
      let plugin3 = {
        filter: "**/*.html",
        async* processFiles (files) {
          for await (let file of files) {
            file.text += "3";
            yield file;
          }
        }
      };
      let plugin4 = {
        filter: "*/*.txt",
        async* processFiles (files) {
          for await (let file of files) {
            file.text += "4";
            yield file;
          }
        }
      };

      let spy = sinon.spy();

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2, plugin3, plugin4, spy);
      await engine.build();

      sinon.assert.callCount(spy, 6);

      let files = getCallArg(spy);
      expect(files.find((file) => file.path === "file.txt").text).to.equal("1");
      expect(files.find((file) => file.path === "file.html").text).to.equal("13");
      expect(files.find((file) => file.path === path.normalize("subdir/file.txt")).text).to.equal("14");
      expect(files.find((file) => file.path === path.normalize("subdir/file.html")).text).to.equal("13");
      expect(files.find((file) => file.path === path.normalize("subdir/subsubdir/file.txt")).text).to.equal("1");
      expect(files.find((file) => file.path === path.normalize("subdir/subsubdir/file.html")).text).to.equal("13");
    });

    it("should call the processFiles() methods in order for each file", async () => {
      let source = {
        name: "File Source",
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        },
      };
      let processor1 = {
        name: "File Processor 1",
        async* processFiles (files) {
          for await (let file of files) {
            file.text += "1";
            yield file;
          }
        }
      };
      let processor2 = {
        name: "File Processor 2",
        async* processFiles (files) {
          for await (let file of files) {
            file.text += "2";
            yield file;
          }
        }
      };
      let processor3 = {
        name: "File Processor 3",
        async* processFiles (files) {
          for await (let file of files) {
            file.text += "3";
            yield file;
          }
        }
      };

      let spy = sinon.spy();
      let engine = CodeEngine.create();
      await engine.use(source, processor1, processor2, processor3, spy);
      await engine.build();

      let files = getCallArg(spy);
      expect(files).to.have.lengthOf(3);
      for (let file of files) {
        expect(file.text).to.equal("123");
      }
    });

    it("should be called with the plugin's `this` context", async () => {
      let plugin1 = {
        name: "Plugin A",
        id: 11111,
        read () { return { path: "file1" }; },
        processFiles: sinon.stub().returnsArg(0),
      };

      let plugin2 = {
        name: "Plugin B",
        id: 22222,
        foo: "bar",
        processFiles: sinon.spy(),
      };

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2);
      await engine.build();

      sinon.assert.calledOnce(plugin1.processFiles);
      sinon.assert.calledOn(plugin1.processFiles, plugin1);

      sinon.assert.calledOnce(plugin2.processFiles);
      sinon.assert.calledOn(plugin2.processFiles, plugin2);
    });

    it("should re-throw synchronous errors", async () => {
      let source = {
        name: "File Source",
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        },
      };

      let plugin = {
        name: "Synchronous Error Test",
        processFiles () {
          throw new SyntaxError("Boom!");
        }
      };

      let engine = CodeEngine.create();
      await engine.use(source, plugin);

      try {
        await engine.build();
        assert.fail("CodeEngine should have re-thrown the error");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error).not.to.be.an.instanceOf(SyntaxError);
        expect(error.message).to.equal("An error occurred in Synchronous Error Test while processing files. \nBoom!");
      }
    });

    it("should re-throw asynchronous errors", async () => {
      let source = {
        name: "File Source",
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        },
      };

      let plugin = {
        name: "Async Error Test",
        async* processFiles (files) {
          for await (let file of files) {
            if (file.path === "file2.txt") {
              throw new SyntaxError("Boom!");
            }
            yield file;
          }
        }
      };

      let engine = CodeEngine.create();
      await engine.use(source, plugin);

      try {
        await engine.build();
        assert.fail("CodeEngine should have re-thrown the error");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error).not.to.be.an.instanceOf(TypeError);
        expect(error.message).to.equal("An error occurred in Async Error Test while processing files. \nBoom!");
      }
    });

  });
});
