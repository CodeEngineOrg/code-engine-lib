"use strict";

const sinon = require("sinon");
const CodeEngine = require("../utils/code-engine");
const { createModule, delay } = require("../utils/utils");

describe("Plugin.processFile()", () => {

  it("should do nothing if no plugins implement processFile", async () => {
    let plugin1 = {
      name: "Plugin 1",
      find: sinon.stub().returns([]),
    };
    let plugin2 = {
      name: "Plugin 2",
      find: sinon.stub().returns([]),
    };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    await engine.build();

    sinon.assert.calledOnce(plugin1.find);
    sinon.assert.calledOnce(plugin2.find);
  });

  it("should call the processFile() method for each file", async () => {
    let plugin = {
      name: "Plugin",
      *find () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt" };
        yield { path: "file3.txt" };
      },
      processFile: sinon.spy(),
    };

    let engine = CodeEngine.create();
    await engine.use(plugin);
    await engine.build();

    sinon.assert.calledThrice(plugin.processFile);
  });

  it("should call the processFile() method of all plugins", async () => {
    let plugin1 = {
      name: "Plugin 1",
      *find () {
        yield { path: "file1.txt" };
        yield { path: "file2.txt" };
        yield { path: "file3.txt" };
        yield { path: "file4.txt" };
      },
      processFile: sinon.spy(),
    };
    let plugin2 = {
      name: "Plugin 2",
      processFile: sinon.spy(),
    };
    let plugin3 = {
      name: "Plugin 3",
      processFile: sinon.spy(),
    };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2, plugin3);
    await engine.build();

    sinon.assert.callCount(plugin1.processFile, 4);
    sinon.assert.callCount(plugin2.processFile, 4);
    sinon.assert.callCount(plugin3.processFile, 4);
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
    let processor1 = {
      name: "File Processor 1",
      processFile: sinon.spy(),
    };
    let processor2 = {
      name: "File Processor 2",
      processFile: sinon.spy(),
    };
    let processor3 = {
      name: "File Processor 3",
      processFile: sinon.spy(),
    };

    let engine = CodeEngine.create();
    await engine.use(source, processor1, processor2, processor3);
    await engine.build();

    sinon.assert.calledThrice(processor1.processFile);
    sinon.assert.calledThrice(processor2.processFile);
    sinon.assert.calledThrice(processor3.processFile);

    assertCallOrder(
      processor1.processFile.getCalls().find((call) => call.args[0].path === "file1.txt"),
      processor2.processFile.getCalls().find((call) => call.args[0].path === "file1.txt"),
      processor3.processFile.getCalls().find((call) => call.args[0].path === "file1.txt"),
    );

    assertCallOrder(
      processor1.processFile.getCalls().find((call) => call.args[0].path === "file2.txt"),
      processor2.processFile.getCalls().find((call) => call.args[0].path === "file2.txt"),
      processor3.processFile.getCalls().find((call) => call.args[0].path === "file2.txt"),
    );

    assertCallOrder(
      processor1.processFile.getCalls().find((call) => call.args[0].path === "file3.txt"),
      processor2.processFile.getCalls().find((call) => call.args[0].path === "file3.txt"),
      processor3.processFile.getCalls().find((call) => call.args[0].path === "file3.txt"),
    );
  });

  it("should move each file through the plugin pipeline separately", async () => {
    /* eslint-disable camelcase */
    let source = {
      name: "File Source",
      *find () {
        yield { path: "file1.txt", metadata: { fileId: 1 }};
        yield { path: "file2.txt", metadata: { fileId: 2 }};
        yield { path: "file3.txt", metadata: { fileId: 3 }};
      },
    };
    let processor1 = {
      name: "File Processor 1",
      processFile: sinon.spy(function processor1_procesFile ({ metadata: { fileId }}) {
        return delay(fileId === 1 ? 500 : fileId === 2 ? 100 : 10);
      })
    };
    let processor2 = {
      name: "File Processor 2",
      processFile: sinon.spy(function processor2_processFile ({ metadata: { fileId }}) {
        return delay(fileId === 1 ? 10 : fileId === 2 ? 500 : 10);
      })
    };
    let processor3 = {
      name: "File Processor 3",
      processFile: sinon.spy(function processor3_processFile () {
        return delay(10);
      })
    };

    let engine = CodeEngine.create();
    await engine.use(source, processor1, processor2, processor3);
    await engine.build();

    sinon.assert.calledThrice(processor1.processFile);
    sinon.assert.calledThrice(processor2.processFile);
    sinon.assert.calledThrice(processor3.processFile);

    assertCallOrder(
      // All of the processor1 calls should happen before ANY of the processor2 calls
      processor1.processFile.getCall(0),
      processor1.processFile.getCall(1),
      processor1.processFile.getCall(2),

      // file3 should be fully processed before file1 or file2 finishes processor1
      processor2.processFile.getCalls().find((call) => call.args[0].path === "file3.txt"),
      processor3.processFile.getCalls().find((call) => call.args[0].path === "file3.txt"),

      // // Next, file2 finishes processor1 and starts processor2
      processor2.processFile.getCalls().find((call) => call.args[0].path === "file2.txt"),

      // // Next, file1 finishes processor1 and is processed by processor2 and processor3
      processor2.processFile.getCalls().find((call) => call.args[0].path === "file1.txt"),
      processor3.processFile.getCalls().find((call) => call.args[0].path === "file1.txt"),

      // // And finally, file2 finishes processor2 and starts processor3
      processor3.processFile.getCalls().find((call) => call.args[0].path === "file2.txt"),
    );
  });

  it("should move each file through the plugin pipeline separately (on worker threads)", async () => {
    let source = {
      name: "File Source",
      *find () {
        yield { path: "file1.txt", contents: "[]" };
        yield { path: "file2.txt", contents: "[]" };
        yield { path: "file3.txt", contents: "[]" };
      },
    };

    let pluginCode = `
      module.exports = ({ processorId, delays }) => {
        return {
          name: "File Processor " + processorId,
          async processFile (file, context) {
            // Mimic a Sinon spy call
            let call = {
              callId: Date.now(),
              args: [file.toString()],
              proxy: { displayName: "processFile" },
            };

            let delay = delays[file.path];
            await new Promise((resolve) => setTimeout(resolve, delay));

            context.logger.log("This is a log");
            context.logger.warn("This is a warning", { foo: "bar", now: new Date("2018-05-15T19:35:45.123Z") })

            let array = JSON.parse(String(file.contents));
            array.push({ processorId, ...call });
            file.contents = Buffer.from(JSON.stringify(array));
          }
        };
      };
    `;

    let processor1 = {
      moduleId: await createModule(pluginCode),
      data: {
        processorId: 1,
        delays: {
          "file1.txt": 500,
          "file2.txt": 100,
          "file3.txt": 10,
        },
      }
    };
    let processor2 = {
      moduleId: await createModule(pluginCode),
      data: {
        processorId: 2,
        delays: {
          "file1.txt": 10,
          "file2.txt": 500,
          "file3.txt": 10,
        },
      }
    };
    let processor3 = {
      moduleId: await createModule(pluginCode),
      data: {
        processorId: 3,
        delays: {
          "file1.txt": 10,
          "file2.txt": 10,
          "file3.txt": 10,
        },
      }
    };

    let engine = CodeEngine.create({ concurrency: 1 });
    await engine.use(source, processor1, processor2, processor3);
    let files = await engine.build();

    let file1Calls = JSON.parse(files.demand("file1.txt").contents.toString());
    let file2Calls = JSON.parse(files.demand("file2.txt").contents.toString());
    let file3Calls = JSON.parse(files.demand("file3.txt").contents.toString());

    assertCallOrder(
      // All of the processor1 calls should happen before ANY of the processor2 calls
      file1Calls.find((call) => call.processorId === 1),
      file2Calls.find((call) => call.processorId === 1),
      file3Calls.find((call) => call.processorId === 1),

      // file3 should be fully processed before file1 or file2 finishes processor1
      file3Calls.find((call) => call.processorId === 2),
      file3Calls.find((call) => call.processorId === 3),

      // // Next, file2 finishes processor1 and starts processor2
      file2Calls.find((call) => call.processorId === 2),

      // // Next, file1 finishes processor1 and is processed by processor2 and processor3
      file1Calls.find((call) => call.processorId === 2),
      file1Calls.find((call) => call.processorId === 3),

      // // And finally, file2 finishes processor2 and starts processor3
      file2Calls.find((call) => call.processorId === 3),
    );
  });

});


/**
 * Asserts the given Sinon calls were called in the given order.
 *
 * @param calls {...SinonSpyCall} - The Sinon calls to check the order of
 */
function assertCallOrder (...calls) {
  let actualOrder = calls.slice().sort((a, b) => {
    return a.callId - b.callId;
  });

  for (let i = 1; i < calls.length; i++) {
    let expected = calls[i];
    let actual = actualOrder[i];

    if (actual !== expected) {
      throw new Error(
        "Incorrect call order. Actual order was:\n  " +
        actualOrder.map((call) => `${call.proxy.displayName}(${call.args[0]})`).join("\n  ")
      );
    }
  }
}
