"use strict";

const { CodeEngine } = require("../../");
const { getFiles, testThreadConsistency } = require("../utils");
const { assert, expect } = require("chai");
const sinon = require("sinon");
const path = require("path");

describe("Plugin.processFile()", () => {
  testThreadConsistency((createModule) => {

    it("should do nothing if no plugins implement processFile", async () => {
      let plugin1 = {
        read: sinon.stub().returns([]),
      };
      let plugin2 = { name: "Plugin 2", read () {} };

      let engine = new CodeEngine();
      await engine.use(plugin1, plugin2);
      await engine.build();

      sinon.assert.calledOnce(plugin1.read);
    });

    it("should call the processFile() method for each file", async () => {
      let plugin1 = {
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        },
      };

      let plugin2 = await createModule((file) => {
        file.text = "Plugin 2 was here";
        return file;
      });

      let spy = sinon.spy();

      let engine = new CodeEngine();
      await engine.use(plugin1, plugin2, spy);
      await engine.build();

      sinon.assert.calledThrice(spy);
      let files = getFiles(spy);
      for (let file of files) {
        expect(file.text).to.equal("Plugin 2 was here");
      }
    });

    it("should call the processFile() method of all plugins", async () => {
      let plugin1 = {
        *read () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
          yield { path: "file4.txt" };
        },
        processFile: sinon.stub().returnsArg(0),
      };
      let plugin2 = sinon.stub().returnsArg(0);
      let plugin3 = await createModule((file) => {
        file.text = "Plugin 4 was here";
        return file;
      });
      let plugin4 = sinon.spy();

      let engine = new CodeEngine();
      await engine.use(plugin1, plugin2, plugin3, plugin4);
      await engine.build();

      sinon.assert.callCount(plugin1.processFile, 4);
      sinon.assert.callCount(plugin2, 4);
      sinon.assert.callCount(plugin4, 4);

      let files = getFiles(plugin4);
      for (let file of files) {
        expect(file.text).to.equal("Plugin 4 was here");
      }
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
        processFile: await createModule((file) => { file.text += "1"; return file; }),
      };
      let plugin2 = {
        filter: false,
        processFile: await createModule((file) => { file.text += "2"; return file; }),
      };
      let plugin3 = {
        filter: "**/*.html",
        processFile: await createModule((file) => { file.text += "3"; return file; }),
      };
      let plugin4 = {
        filter: "*/*.txt",
        processFile: await createModule((file) => { file.text += "4"; return file; }),
      };

      let spy = sinon.spy();

      let engine = new CodeEngine();
      await engine.use(plugin1, plugin2, plugin3, plugin4, spy);
      await engine.build();

      sinon.assert.callCount(spy, 6);

      let files = getFiles(spy);
      expect(files.find((file) => file.path === "file.txt").text).to.equal("1");
      expect(files.find((file) => file.path === "file.html").text).to.equal("13");
      expect(files.find((file) => file.path === path.normalize("subdir/file.txt")).text).to.equal("14");
      expect(files.find((file) => file.path === path.normalize("subdir/file.html")).text).to.equal("13");
      expect(files.find((file) => file.path === path.normalize("subdir/subsubdir/file.txt")).text).to.equal("1");
      expect(files.find((file) => file.path === path.normalize("subdir/subsubdir/file.html")).text).to.equal("13");
    });

    it("should call the processFile() methods in order for each file", async () => {
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
        processFile: await createModule((file) => { file.text += "1"; return file; }),
      };
      let processor2 = {
        name: "File Processor 2",
        processFile: await createModule((file) => { file.text += "2"; return file; }),
      };
      let processor3 = {
        name: "File Processor 3",
        processFile: await createModule((file) => { file.text += "3"; return file; }),
      };

      let spy = sinon.spy();
      let engine = new CodeEngine();
      await engine.use(source, processor1, processor2, processor3, spy);
      await engine.build();

      let files = getFiles(spy);
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
        processFile: await createModule(function (file) {
          file.text = this === undefined ? "undefined\n" : `${this.id}: ${this.name}\n`;
          return file;
        }),
      };

      let plugin2 = {
        name: "Plugin B",
        id: 22222,
        foo: "bar",
        processFile: await createModule(function (file) {
          file.text += this === undefined ? "undefined" : `${this.id}: ${this.name} ${this.foo}\n`;
          return file;
        }),
      };

      let spy = sinon.spy();
      let engine = new CodeEngine();
      await engine.use(plugin1, plugin2, spy);
      await engine.build();

      let files = getFiles(spy);
      expect(files).to.have.lengthOf(1);
      expect(files[0].text).to.be.oneOf([
        "11111: Plugin A\n22222: Plugin B bar\n",   // Main thread
        "undefined\nundefined",                     // Worker thread
      ]);
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
        processFile: await createModule((file) => {
          if (file.path === "file2.txt") {
            throw new SyntaxError("Boom!");
          }
        })
      };

      let engine = new CodeEngine();
      await engine.use(source, plugin);

      try {
        await engine.build();
        assert.fail("CodeEngine should have re-thrown the error");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(SyntaxError);
        expect(error.message).to.equal("An error occurred in Synchronous Error Test while processing file2.txt. \nBoom!");
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

      let plugin = await createModule((file) => {
        if (file.path === "file3.txt") {
          return Promise.reject(new TypeError("Boom!"));
        }
        else {
          return Promise.resolve();
        }
      });

      let engine = new CodeEngine();
      await engine.use(source, plugin);

      try {
        await engine.build();
        assert.fail("CodeEngine should have re-thrown the error");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(TypeError);
        expect(error.message).to.equal("An error occurred in Plugin 2 while processing file3.txt. \nBoom!");
      }
    });

  });
});
