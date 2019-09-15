"use strict";

const CodeEngine = require("../utils/code-engine");
const { testThreadConsistency } = require("../utils/utils");
const { expect } = require("chai");
const sinon = require("sinon");

describe("Plugin.processFile()", () => {
  testThreadConsistency((createPlugin) => {

    it("should do nothing if no plugins implement processFile", async () => {
      let plugin1 = {
        find: sinon.stub().returns([]),
      };
      let plugin2 = await createPlugin(() => ({
        name: "Plugin 2",
      }));

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2);
      await engine.build();

      sinon.assert.calledOnce(plugin1.find);
    });

    it("should call the processFile() method for each file", async () => {
      let plugin1 = {
        *find () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        },
        processFile: sinon.spy(),
      };

      let plugin2 = await createPlugin(() => ({
        processFile (file) {
          file.contents = Buffer.from("Plugin 2 was here");
        }
      }));

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2);
      let files = await engine.build();

      sinon.assert.calledThrice(plugin1.processFile);
      expect(files.size).to.equal(3);
      for (let file of files) {
        expect(file.contents.toString()).to.equal("Plugin 2 was here");
      }
    });

    it("should call the processFile() method of all plugins", async () => {
      let plugin1 = {
        *find () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
          yield { path: "file4.txt" };
        },
        processFile: sinon.spy(),
      };
      let plugin2 = {
        processFile: sinon.spy(),
      };
      let plugin3 = {
        processFile: sinon.spy(),
      };
      let plugin4 = await createPlugin(() => ({
        processFile (file) {
          file.contents = Buffer.from("Plugin 4 was here");
        }
      }));

      let engine = CodeEngine.create();
      await engine.use(plugin1, plugin2, plugin3, plugin4);
      let files = await engine.build();

      sinon.assert.callCount(plugin1.processFile, 4);
      sinon.assert.callCount(plugin2.processFile, 4);
      sinon.assert.callCount(plugin3.processFile, 4);

      expect(files.size).to.equal(4);
      for (let file of files) {
        expect(file.contents.toString()).to.equal("Plugin 4 was here");
      }
    });

    it("should call the processFile() methods in order for each file", async () => {
      let source = {
        name: "File Source",
        *find () {
          yield { path: "file1.txt" };
          yield { path: "file2.txt" };
          yield { path: "file3.txt" };
        },
      };
      let processor1 = await createPlugin(() => ({
        name: "File Processor 1",
        processFile (file) {
          file.contents = Buffer.from(String(file.contents) + "1");
        },
      }));
      let processor2 = await createPlugin(() => ({
        name: "File Processor 2",
        processFile (file) {
          file.contents = Buffer.from(String(file.contents) + "2");
        },
      }));
      let processor3 = await createPlugin(() => ({
        name: "File Processor 3",
        processFile (file) {
          file.contents = Buffer.from(String(file.contents) + "3");
        },
      }));

      let engine = CodeEngine.create();
      await engine.use(source, processor1, processor2, processor3);
      let files = await engine.build();

      expect(files.size).to.equal(3);
      for (let file of files) {
        expect(file.contents.toString()).to.equal("123");
      }
    });

    it("should move each file through the plugin pipeline separately", async () => {
      let source = {
        name: "File Source",
        *find () {
          yield { path: "file1.txt", contents: "[]" };
          yield { path: "file2.txt", contents: "[]" };
          yield { path: "file3.txt", contents: "[]" };
        },
      };

      function pluginFactory ({ processorId, delays }) {
        return {
          name: "File Processor " + processorId,
          async processFile (file) {
            let now = new Date();
            let delay = delays[file.path];
            await new Promise((resolve) => setTimeout(resolve, delay));

            let array = JSON.parse(String(file.contents));
            array.push({ path: file.path, processorId, now });
            file.contents = Buffer.from(JSON.stringify(array));
          }
        };
      }

      let processor1 = await createPlugin(pluginFactory, {
        processorId: 1,
        delays: {
          "file1.txt": 500,
          "file2.txt": 100,
          "file3.txt": 10,
        },
      });
      let processor2 = await createPlugin(pluginFactory, {
        processorId: 2,
        delays: {
          "file1.txt": 10,
          "file2.txt": 500,
          "file3.txt": 10,
        },
      });
      let processor3 = await createPlugin(pluginFactory, {
        processorId: 3,
        delays: {
          "file1.txt": 10,
          "file2.txt": 10,
          "file3.txt": 10,
        },
      });

      let engine = CodeEngine.create({ concurrency: 1 });
      await engine.use(source, processor1, processor2, processor3);
      let files = await engine.build();

      let calls = [
        ...JSON.parse(files.demand("file1.txt").contents.toString()),
        ...JSON.parse(files.demand("file2.txt").contents.toString()),
        ...JSON.parse(files.demand("file3.txt").contents.toString()),
      ];

      calls.sort((a, b) => new Date(a.now) - new Date(b.now));

      let expectedOrder = [
        // All of the processor1 calls should happen before ANY of the processor2 calls
        calls.find(({ path, processorId }) => path === "file1.txt" && processorId === 1),
        calls.find(({ path, processorId }) => path === "file2.txt" && processorId === 1),
        calls.find(({ path, processorId }) => path === "file3.txt" && processorId === 1),

        // file3 should be fully processed before file1 or file2 finishes processor1
        calls.find(({ path, processorId }) => path === "file3.txt" && processorId === 2),
        calls.find(({ path, processorId }) => path === "file3.txt" && processorId === 3),

        // // Next, file2 finishes processor1 and starts processor2
        calls.find(({ path, processorId }) => path === "file2.txt" && processorId === 2),

        // // Next, file1 finishes processor1 and is processed by processor2 and processor3
        calls.find(({ path, processorId }) => path === "file1.txt" && processorId === 2),
        calls.find(({ path, processorId }) => path === "file1.txt" && processorId === 3),

        // // And finally, file2 finishes processor2 and starts processor3
        calls.find(({ path, processorId }) => path === "file2.txt" && processorId === 3),
      ];

      try {
        expect(calls).to.deep.equal(expectedOrder);
      }
      catch (e) {
        throw new Error(
          "Incorrect call order.  Actual order was:\n  " +
          calls.map(({ path, processorId, now }) => `${now} processor${processorId}(${path})`).join("\n  ")
        );
      }
    });

  });
});
