"use strict";

const CodeEngine = require("../utils/code-engine");
const { delay, getCallArg, testThreadConsistency } = require("../utils/utils");
const { assert, expect } = require("chai");
const sinon = require("sinon");
const path = require("path");
const ono = require("ono");

describe("Plugin.processFile()", () => {
  testThreadConsistency((createModule) => {

    it("should do nothing if no plugins implement processFile", async () => {
      let plugin1 = {
        read: sinon.stub().returns([]),
      };
      let plugin2 = { name: "Plugin 2", read () {} };

      let engine = CodeEngine.create();
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

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2, spy);
      await engine.build();

      sinon.assert.calledThrice(spy);
      let files = getCallArg(spy);
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

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2, plugin3, plugin4);
      await engine.build();

      sinon.assert.callCount(plugin1.processFile, 4);
      sinon.assert.callCount(plugin2, 4);
      sinon.assert.callCount(plugin4, 4);

      let files = getCallArg(plugin4);
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
      let engine = CodeEngine.create();
      await engine.use(source, processor1, processor2, processor3, spy);
      await engine.build();

      let files = getCallArg(spy);
      expect(files).to.have.lengthOf(3);
      for (let file of files) {
        expect(file.text).to.equal("123");
      }
    });

    it("should move each file through the plugin pipeline separately", async () => {
      let source = {
        name: "File Source",
        *read () {
          yield { path: "file1.txt", text: "[]" };
          delay(50);
          yield { path: "file2.txt", text: "[]" };
          delay(50);
          yield { path: "file3.txt", text: "[]" };
        },
      };

      function fileProcessorFactory (data) {
        return async function processFile (file) {
          let { processorId, delays } = data;
          let now = new Date();
          let delay = delays[file.path];
          await new Promise((resolve) => setTimeout(resolve, delay));

          let array = JSON.parse(file.text);
          array.push({ path: file.path, processorId, now });
          file.text = JSON.stringify(array);
          return file;
        };
      }

      let processor1 = {
        name: "Processor 1",
        processFile: await createModule(fileProcessorFactory, {
          processorId: 1,
          delays: {
            "file1.txt": 500,
            "file2.txt": 100,
            "file3.txt": 10,
          },
        })
      };
      let processor2 = {
        name: "Processor 2",
        processFile: await createModule(fileProcessorFactory, {
          processorId: 2,
          delays: {
            "file1.txt": 10,
            "file2.txt": 500,
            "file3.txt": 10,
          },
        })
      };
      let processor3 = {
        name: "Processor 3",
        processFile: await createModule(fileProcessorFactory, {
          processorId: 3,
          delays: {
            "file1.txt": 10,
            "file2.txt": 10,
            "file3.txt": 10,
          },
        })
      };

      let spy = sinon.spy();
      let engine = CodeEngine.create({ concurrency: 3 });
      await engine.use(source, processor1, processor2, processor3, spy);
      await engine.build();

      let files = getCallArg(spy);
      let calls = []
        .concat(...files.map((file) => JSON.parse(file.text)))
        .sort((a, b) => new Date(a.now) - new Date(b.now));

      function removeTimestamp ({ path, processorId }) {
        return { path, processorId };
      }

      try {
        // All of the processor1 calls should happen before ANY of the processor2 calls.
        // The order of the processor1 calls is unimportant.
        let processor1Calls = calls.slice(0, 3).map(removeTimestamp);
        expect(processor1Calls).to.have.same.deep.members([
          { processorId: 1, path: "file1.txt" },
          { processorId: 1, path: "file2.txt" },
          { processorId: 1, path: "file3.txt" },
        ]);

        // file3 should be fully processed before file1 or file2 finishes processor1
        expect(removeTimestamp(calls[3])).to.deep.equal({ processorId: 2, path: "file3.txt" });
        expect(removeTimestamp(calls[4])).to.deep.equal({ processorId: 3, path: "file3.txt" });

        // Next, file2 finishes processor1 and starts processor2
        expect(removeTimestamp(calls[5])).to.deep.equal({ processorId: 2, path: "file2.txt" });

        // Next, file1 finishes processor1 and is processed by processor2 and processor3
        expect(removeTimestamp(calls[6])).to.deep.equal({ processorId: 2, path: "file1.txt" });
        expect(removeTimestamp(calls[7])).to.deep.equal({ processorId: 3, path: "file1.txt" });

        // And finally, file2 finishes processor2 and starts processor3
        expect(removeTimestamp(calls[8])).to.deep.equal({ processorId: 3, path: "file2.txt" });
      }
      catch (error) {
        throw ono(error,
          "Incorrect call order.  Actual order was:\n  " +
          calls.map(({ path, processorId, now }) => `${now} processor${processorId}(${path})`).join("\n  ")
        );
      }
    });

    it("should be called with the plugin's `this` context", async () => {
      let plugin1 = {
        name: "Plugin A",
        id: 11111,
        read () { return { path: "file1" }; },
        processFile: await createModule(function (file) {
          file.text = `${this.id}: ${this.name}\n`;
          return file;
        }),
      };

      let plugin2 = {
        name: "Plugin B",
        id: 22222,
        foo: "bar",
        processFile: await createModule(function (file) {
          file.text += `${this.id}: ${this.name} ${this.foo}\n`;
          return file;
        }),
      };

      let spy = sinon.spy();
      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2, spy);
      await engine.build();

      let files = getCallArg(spy);
      expect(files).to.have.lengthOf(1);
      expect(files[0].text).to.equal("11111: Plugin A\n22222: Plugin B bar\n");
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

      let engine = CodeEngine.create();
      await engine.use(source, plugin);

      try {
        await engine.build();
        assert.fail("CodeEngine should have re-thrown the error");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error).not.to.be.an.instanceOf(SyntaxError);
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

      let engine = CodeEngine.create();
      await engine.use(source, plugin);

      try {
        await engine.build();
        assert.fail("CodeEngine should have re-thrown the error");
      }
      catch (error) {
        expect(error).to.be.an.instanceOf(Error);
        expect(error).not.to.be.an.instanceOf(TypeError);
        expect(error.message).to.equal("An error occurred in Plugin 2 while processing file3.txt. \nBoom!");
      }
    });

  });
});
