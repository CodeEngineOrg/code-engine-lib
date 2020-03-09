"use strict";

const path = require("path");
const sinon = require("sinon");
const { CodeEngine } = require("../../");
const { delay, getFiles, getFilePaths, createModule } = require("../utils");
const { host } = require("@jsdevtools/host-environment");
const { assert, expect } = require("chai");

// CI environments are slow, so use a larger time buffer
const TIME_BUFFER = host.ci ? 300 : 75;

describe("Plugin.read()", () => {

  it("should call the read() method of all plugins", async () => {
    let plugin1 = { read: sinon.stub().returns([]) };
    let plugin2 = { read: sinon.stub().returns([]) };

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2);
    let summary = await engine.run();

    sinon.assert.calledOnce(plugin1.read);
    sinon.assert.calledOnce(plugin2.read);
    expect(summary.input.fileCount).to.equal(0);
    expect(summary.output.fileCount).to.equal(0);
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

    let engine = new CodeEngine();
    await engine.use(iterable, iterator, generator, asyncGenerator, spy);
    let summary = await engine.run();

    expect(summary.input.fileCount).to.equal(8);

    sinon.assert.callCount(spy, 8);
    let filePaths = getFilePaths(spy);
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

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2, spy);
    let summary = await engine.run();

    expect(summary.input.fileCount).to.equal(5);

    sinon.assert.callCount(spy, 5);
    let files = getFiles(spy);
    expect(files[0]).to.have.property("path", "file3.txt");
    expect(files[1]).to.have.property("path", "file4.txt");
    expect(files[2]).to.have.property("path", "file1.txt");
    expect(files[3]).to.have.property("path", "file5.txt");
    expect(files[4]).to.have.property("path", "file2.txt");
  });

  it("should read multiple files simultaneously, up to the concurrency limit", async () => {
    let readTimes = [];                                             // Keeps track of when each file is read

    let plugin = {
      read () {
        let i = 0;
        return {
          async next () {
            if (++i > 5) {
              return { done: true };
            }

            readTimes.push(Date.now());                             // Trach when read() was called
            await delay(500);                                       // Each file will take 500ms to read
            return { value: { path: `file${i}.txt` }};
          }
        };
      }
    };

    let engine = new CodeEngine({ concurrency: 3 });             // We can read 3 files simultaneously
    await engine.use(plugin);
    let summary = await engine.run();
    readTimes = readTimes.map(t => t - summary.time.start);

    // Make sure all 5 files were read
    expect(summary.input.fileCount).to.equal(5);

    // 0ms: The first 3 files are read simultaneously
    expect(readTimes[0]).to.be.at.most(TIME_BUFFER);
    expect(readTimes[1]).to.be.at.most(TIME_BUFFER);
    expect(readTimes[2]).to.be.at.most(TIME_BUFFER);

    // 500ms: The last two files are read simultaneously
    expect(readTimes[3]).to.be.at.least(500).and.at.most(500 + TIME_BUFFER);
    expect(readTimes[4]).to.be.at.least(500).and.at.most(500 + TIME_BUFFER);

    // 1000ms: All done
    expect(summary.time.elapsed).to.be.at.least(1000).and.at.most(1000 + TIME_BUFFER);
  });

  it("should read multiple files simultaneously from multiple sources, up to the concurrency limit", async () => {
    function createSource (offset) {
      let readTimes = [];                                           // Keeps track of when each file is read
      return {
        readTimes,
        read () {
          let i = offset;
          return {
            async next () {
              if (++i > offset + 3) {                               // 3 files x 3 readers = 9 files total
                return { done: true };
              }

              readTimes.push(Date.now());                           // Trach when read() was called
              let file = { path: `file${i}.txt` };
              await delay(500);                                     // Each file will take 500ms to read
              return { value: file };
            }
          };
        }
      };
    }

    let plugin1 = createSource(0);
    let plugin2 = createSource(3);
    let plugin3 = createSource(6);

    let engine = new CodeEngine({ concurrency: 5 });             // We can read 5 files simultaneously
    await engine.use(plugin1, plugin2, plugin3);
    let summary = await engine.run();

    plugin1.readTimes = plugin1.readTimes.map(t => t - summary.time.start);
    plugin2.readTimes = plugin2.readTimes.map(t => t - summary.time.start);
    plugin3.readTimes = plugin3.readTimes.map(t => t - summary.time.start);

    // Make sure all 9 files were read
    expect(summary.input.fileCount).to.equal(9);

    // 0ms: The first 5 files are read simultaneously
    expect(plugin1.readTimes[0]).to.be.at.most(TIME_BUFFER);
    expect(plugin2.readTimes[0]).to.be.at.most(TIME_BUFFER);
    expect(plugin3.readTimes[0]).to.be.at.most(TIME_BUFFER);
    expect(plugin1.readTimes[1]).to.be.at.most(TIME_BUFFER);
    expect(plugin2.readTimes[1]).to.be.at.most(TIME_BUFFER);

    // 500ms: The last 4 files are read simultaneously
    expect(plugin3.readTimes[1]).to.be.at.least(500).and.at.most(500 + TIME_BUFFER);
    expect(plugin1.readTimes[2]).to.be.at.least(500).and.at.most(500 + TIME_BUFFER);
    expect(plugin2.readTimes[2]).to.be.at.least(500).and.at.most(500 + TIME_BUFFER);
    expect(plugin3.readTimes[2]).to.be.at.least(500).and.at.most(500 + TIME_BUFFER);

    // 1000ms: All done
    expect(summary.time.elapsed).to.be.at.least(1000).and.at.most(1000 + TIME_BUFFER);
  });

  it("should read multiple files simultaneously, as quickly as the next plugin allows", async () => {
    let reader = {
      read () {
        let i = 0;
        return {
          async next () {
            if (++i > 8) {                                          // 8 files total
              return { done: true };
            }

            let file = { path: `file${i}.txt` };
            let startedReading = Date.now();
            await delay(300);                                       // Each file takes 300ms to read
            let finishedReading = Date.now();

            file.text = JSON.stringify({ startedReading, finishedReading });
            return { value: file };
          }
        };
      },
    };

    let processor = {
      async processFile (file) {
        let json = JSON.parse(file.text);
        json.startedProcessing = Date.now();
        await delay(500);                                           // Each file takes 500ms to process
        json.finishedProcessing = Date.now();
        file.text = JSON.stringify(json);
        return file;
      }
    };

    let spy = sinon.spy();

    let engine = new CodeEngine({ concurrency: 3 });             // We can read 3 files simultaneously
    await engine.use(reader, processor, spy);
    let summary = await engine.run();

    let files = getFiles(spy).map((file) => {
      let { startedReading, finishedReading, startedProcessing, finishedProcessing } = JSON.parse(file.text);
      return {
        name: file.name,
        startedReading: startedReading - summary.time.start,
        finishedReading: finishedReading - summary.time.start,
        startedProcessing: startedProcessing - summary.time.start,
        finishedProcessing: finishedProcessing - summary.time.start,
      };
    });

    let file1 = files.find((file) => file.name === "file1.txt");
    let file2 = files.find((file) => file.name === "file2.txt");
    let file3 = files.find((file) => file.name === "file3.txt");
    let file4 = files.find((file) => file.name === "file4.txt");
    let file5 = files.find((file) => file.name === "file5.txt");
    let file6 = files.find((file) => file.name === "file6.txt");
    let file7 = files.find((file) => file.name === "file7.txt");
    let file8 = files.find((file) => file.name === "file8.txt");

    // 0ms: Files 1, 2, 3, start being read
    expect(file1.startedReading).to.be.at.most(TIME_BUFFER);
    expect(file2.startedReading).to.be.at.most(TIME_BUFFER);
    expect(file3.startedReading).to.be.at.most(TIME_BUFFER);

    // 300ms: Files 1, 2, 3 are done being read and start being processed
    //        Files 4, 5, 6 start being read
    expect(file1.finishedReading).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);
    expect(file2.finishedReading).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);
    expect(file3.finishedReading).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);

    expect(file1.startedProcessing).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);
    expect(file2.startedProcessing).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);
    expect(file3.startedProcessing).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);

    expect(file4.startedReading).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);
    expect(file5.startedReading).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);
    expect(file6.startedReading).to.be.at.least(300).and.at.most(300 + TIME_BUFFER);

    // 600ms: Files 4, 5, 6 are done being read, but can't start processing yet.
    //        File 7 starts being read.
    expect(file4.finishedReading).to.be.at.least(600).and.at.most(600 + TIME_BUFFER);
    expect(file5.finishedReading).to.be.at.least(600).and.at.most(600 + TIME_BUFFER);
    expect(file6.finishedReading).to.be.at.least(600).and.at.most(600 + TIME_BUFFER);

    expect(file7.startedReading).to.be.at.least(600).and.at.most(600 + TIME_BUFFER);

    // 800ms: Files 1, 2, 3 are done processing.
    //        Files 4, 5, 6 start processing.
    //        Files 8 starts being read
    expect(file1.finishedProcessing).to.be.at.least(800).and.at.most(800 + TIME_BUFFER);
    expect(file2.finishedProcessing).to.be.at.least(800).and.at.most(800 + TIME_BUFFER);
    expect(file3.finishedProcessing).to.be.at.least(800).and.at.most(800 + TIME_BUFFER);

    expect(file4.startedProcessing).to.be.at.least(800).and.at.most(800 + TIME_BUFFER);
    expect(file5.startedProcessing).to.be.at.least(800).and.at.most(800 + TIME_BUFFER);
    expect(file6.startedProcessing).to.be.at.least(800).and.at.most(800 + TIME_BUFFER);

    expect(file8.startedReading).to.be.at.least(800).and.at.most(800 + TIME_BUFFER);

    // 900ms: File 7 is done being read, but cannot start processing yet.
    expect(file7.finishedReading).to.be.at.least(900).and.at.most(900 + TIME_BUFFER);

    // 1100ms: File 8 is done being read, but cannot start processing yet.
    expect(file8.finishedReading).to.be.at.least(1100).and.at.most(1100 + TIME_BUFFER);

    // 1300ms: Files 4, 5, 6 are done bineg processed.
    //         Files 7, 8 start processing
    expect(file4.finishedProcessing).to.be.at.least(1300).and.at.most(1300 + TIME_BUFFER);
    expect(file5.finishedProcessing).to.be.at.least(1300).and.at.most(1300 + TIME_BUFFER);
    expect(file6.finishedProcessing).to.be.at.least(1300).and.at.most(1300 + TIME_BUFFER);

    expect(file7.startedProcessing).to.be.at.least(1300).and.at.most(1300 + TIME_BUFFER);
    expect(file8.startedProcessing).to.be.at.least(1300).and.at.most(1300 + TIME_BUFFER);

    // 1800ms: All done
    expect(file7.finishedProcessing).to.be.at.least(1800).and.at.most(1800 + TIME_BUFFER);
    expect(file8.finishedProcessing).to.be.at.least(1800).and.at.most(1800 + TIME_BUFFER);
    expect(summary.time.elapsed).to.be.at.least(1800).and.at.most(1800 + TIME_BUFFER);
  });

  it("should set the source property of all files", async () => {
    let plugin1 = {
      *read () {
        yield { path: "file1.txt" };
      }
    };
    let plugin2 = {
      name: "This is Plugin #2",
      *read () {
        yield { path: "file2.txt" };
      }
    };
    function* plugin3 (file) {
      yield file;

      if (file.name === "file2.txt") {
        yield { path: "file3.txt" };
      }
    }
    let plugin4 = {
      *processFile (file) {
        yield file;

        if (file.name === "file3.txt") {
          yield { path: "file4.txt" };
        }
      }
    };
    let plugin5 = {
      name: "This is Plugin #5",
      *processFile (file) {
        yield file;

        if (file.name === "file4.txt") {
          yield { path: "file5.txt" };
        }
      }
    };
    let plugin6 = await createModule(function* plugin6 (file) {
      yield file;

      if (file.name === "file5.txt") {
        yield { path: "file6.txt" };
      }
    });
    let plugin7 = {
      processFile: await createModule(function* plugin7 (file) {
        yield file;

        if (file.name === "file6.txt") {
          yield { path: "file7.txt" };
        }
      })
    };
    let plugin8 = {
      name: "This is Plugin #8",
      processFile: await createModule(function* (file) {
        yield file;

        if (file.name === "file7.txt") {
          yield { path: "file8.txt" };
        }
      })
    };
    let plugin9 = {
      processFile: await createModule((file) => {
        if (file.name === "file8.txt") {
          return [file, { path: "file9.txt" }];
        }
        else {
          return file;
        }
      })
    };

    let spy = sinon.spy();

    let engine = new CodeEngine({ concurrency: 1 });
    await engine.use(plugin1, plugin2, plugin3, plugin4, plugin5, plugin6, plugin7, plugin8, plugin9, spy);
    await engine.run();

    sinon.assert.callCount(spy, 9);

    let files = getFiles(spy);
    expect(files[0].source).to.equal("code-engine://Plugin-1/file1.txt");
    expect(files[1].source).to.equal("code-engine://This-is-Plugin-2/file2.txt");
    expect(files[2].source).to.equal("code-engine://plugin3/file3.txt");
    expect(files[3].source).to.equal("code-engine://Plugin-4/file4.txt");
    expect(files[4].source).to.equal("code-engine://This-is-Plugin-5/file5.txt");
    expect(files[5].source).to.equal("code-engine://plugin6/file6.txt");
    expect(files[6].source).to.equal("code-engine://plugin7/file7.txt");
    expect(files[7].source).to.equal("code-engine://This-is-Plugin-8/file8.txt");
    expect(files[8].source).to.equal("code-engine://Plugin-9/file9.txt");
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

    let engine = new CodeEngine();
    await engine.use(plugin, spy);
    let summary = await engine.run();

    expect(summary.input.fileCount).to.equal(6);

    sinon.assert.callCount(spy, 6);
    let files = getFiles(spy);
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

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2, spy);
    let summary = await engine.run();

    expect(summary.input.fileCount).to.equal(6);

    sinon.assert.callCount(spy, 6);
    let filePaths = getFilePaths(spy);
    expect(filePaths).to.have.same.members([
      "file1.txt",
      "file1.txt",
      "file2.txt",
      "file2.txt",
      "file3.txt",
      "file3.txt",
    ]);
  });

  it("should ignore unknown fields on FileInfo objects", async () => {
    const expectedKeys = ["source", "sourceMap", "path", "createdAt", "modifiedAt", "metadata", "contents"];

    let plugin = {
      name: "Plugin",
      *read () {
        yield { path: "file1.txt", foo: 123 };
        yield { path: "file2.txt", bar: 456 };
        yield { path: "file3.txt", hello: "world" };
      },
    };

    let spy = sinon.spy();

    let engine = new CodeEngine();
    await engine.use(plugin, spy);
    let summary = await engine.run();

    expect(summary.input.fileCount).to.equal(3);

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
    let engine = new CodeEngine();
    let summary = await engine.run();
    expect(summary.input.fileCount).to.equal(0);
    expect(summary.input.fileSize).to.equal(0);
    expect(summary.output.fileCount).to.equal(0);
    expect(summary.output.fileSize).to.equal(0);
  });

  it("should process an empty set if there are no file sources", async () => {
    let plugin1 = { clean: sinon.spy() };
    let plugin2 = { watch: sinon.spy() };

    let engine = new CodeEngine();
    await engine.use(plugin1, plugin2);
    let summary = await engine.run();

    expect(summary.input.fileCount).to.equal(0);
    expect(summary.input.fileSize).to.equal(0);
    expect(summary.output.fileCount).to.equal(0);
    expect(summary.output.fileSize).to.equal(0);

    sinon.assert.notCalled(plugin1.clean);
    sinon.assert.notCalled(plugin2.watch);
  });

  it("should throw an error if a plugin's read() method returns a non-iterable value", async () => {
    let plugin = {
      read () {
        return 42;
      }
    };

    let engine = new CodeEngine();
    await engine.use(plugin);

    try {
      await engine.run();
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
