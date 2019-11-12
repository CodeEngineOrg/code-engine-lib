"use strict";

const path = require("path");
const sinon = require("sinon");
const CodeEngine = require("../utils/code-engine");
const { delay, getFiles, getFilePaths, createModule } = require("../utils");
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

    let engine = CodeEngine.create();
    await engine.use(iterable, iterator, generator, asyncGenerator, spy);
    let summary = await engine.build();

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

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2, spy);
    let summary = await engine.build();

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

            readTimes.push(Date.now());                               // Trach when read() was called
            await delay(500);                                         // Each file will take 500ms to read
            return { value: { path: `file${i}.txt` }};
          }
        };
      }
    };

    let engine = CodeEngine.create({ concurrency: 3 });             // We can read 3 files simultaneously
    await engine.use(plugin);
    let summary = await engine.build();

    // Make sure all 5 files were read
    expect(summary.input.fileCount).to.equal(5);

    // CI environments are slow, so use a larger time buffer
    const TIME_BUFFER = process.env.CI ? 100 : 50;

    // The first three files should have been read simultaneously
    expect(readTimes[0] - summary.time.start).to.be.at.most(TIME_BUFFER);
    expect(readTimes[1] - summary.time.start).to.be.at.most(TIME_BUFFER);
    expect(readTimes[2] - summary.time.start).to.be.at.most(TIME_BUFFER);

    // The last two files should have been read simultaneously
    expect(readTimes[3] - summary.time.start).to.be.at.least(500).and.at.most(500 + TIME_BUFFER);
    expect(readTimes[4] - summary.time.start).to.be.at.least(500).and.at.most(500 + TIME_BUFFER);

    // The total read time should have been around 1 second
    expect(summary.time.elapsed).to.be.above(1000).and.below(1000 + TIME_BUFFER);
  });

  it("should read multiple files simultaneously from multiple sources, up to the concurrency limit", async () => {
    function createSource () {
      let readTimes = [];                                           // Keeps track of when each file is read
      return {
        readTimes,
        read () {
          let i = 0;
          return {
            async next () {
              if (++i > 3) {
                return { done: true };
              }

              readTimes.push(Date.now());                           // Trach when read() was called
              await delay(500);                                     // Each file will take 500ms to read
              return { value: { path: `file${i}.txt` }};
            }
          };
        }
      };
    }

    let plugin1 = createSource();
    let plugin2 = createSource();
    let plugin3 = createSource();

    let engine = CodeEngine.create({ concurrency: 5 });             // We can read 5 files simultaneously
    await engine.use(plugin1, plugin2, plugin3);
    let summary = await engine.build();

    // Make sure all 9 files were read
    expect(summary.input.fileCount).to.equal(9);

    // CI environments are slow, so use a larger time buffer
    const TIME_BUFFER = process.env.CI ? 100 : 50;

    // The first 5 files should have been read simultaneously
    expect(plugin1.readTimes[0] - summary.time.start).to.be.at.most(TIME_BUFFER);
    expect(plugin2.readTimes[0] - summary.time.start).to.be.at.most(TIME_BUFFER);
    expect(plugin3.readTimes[0] - summary.time.start).to.be.at.most(TIME_BUFFER);
    expect(plugin1.readTimes[1] - summary.time.start).to.be.at.most(TIME_BUFFER);
    expect(plugin2.readTimes[1] - summary.time.start).to.be.at.most(TIME_BUFFER);

    // The last 4 files should have been read simultaneously
    expect(plugin3.readTimes[1] - summary.time.start).to.be.at.most(500 + TIME_BUFFER);
    expect(plugin1.readTimes[2] - summary.time.start).to.be.at.most(500 + TIME_BUFFER);
    expect(plugin2.readTimes[2] - summary.time.start).to.be.at.most(500 + TIME_BUFFER);
    expect(plugin3.readTimes[2] - summary.time.start).to.be.at.most(500 + TIME_BUFFER);

    // The total read time should have been around 1 second
    expect(summary.time.elapsed).to.be.above(1000).and.below(1000 + TIME_BUFFER);
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

    let engine = CodeEngine.create({ concurrency: 1 });
    await engine.use(plugin1, plugin2, plugin3, plugin4, plugin5, plugin6, plugin7, plugin8, plugin9, spy);
    await engine.build();

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

    let engine = CodeEngine.create();
    await engine.use(plugin, spy);
    let summary = await engine.build();

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

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2, spy);
    let summary = await engine.build();

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

    let engine = CodeEngine.create();
    await engine.use(plugin, spy);
    let summary = await engine.build();

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
    let engine = CodeEngine.create();
    let summary = await engine.build();
    expect(summary.input.fileCount).to.equal(0);
    expect(summary.input.fileSize).to.equal(0);
    expect(summary.output.fileCount).to.equal(0);
    expect(summary.output.fileSize).to.equal(0);
  });

  it("should process an empty set if there are no file sources", async () => {
    let plugin1 = { clean: sinon.spy() };
    let plugin2 = { watch: sinon.spy() };

    let engine = CodeEngine.create();
    await engine.use(plugin1, plugin2);
    let summary = await engine.build();

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
