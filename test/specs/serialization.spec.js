/* eslint-disable no-new-wrappers, no-new-object */
"use strict";

const CodeEngine = require("../utils/code-engine");
const { createModule } = require("../utils/utils");
const { expect } = require("chai");
const sinon = require("sinon");
const ono = require("ono");

describe("Worker serialization", () => {

  it("should serialize primitives", async () => {
    let originalData = {
      nil: null,
      notDefined: undefined,
      notANumber: NaN,
      bool: true,
      falseBool: false,
      string: "Hello, world",
      emptyString: "",
      integer: 42,
      float: 3.14159,
      negative: -42,
      zero: 0,
      infinity: Infinity,
    };

    let [serialized, mutated] = await testSerialization(originalData, mutate);

    expect(serialized).to.deep.equal({
      nil: null,
      notDefined: undefined,
      notANumber: NaN,
      bool: true,
      falseBool: false,
      string: "Hello, world",
      emptyString: "",
      integer: 42,
      float: 3.14159,
      negative: -42,
      zero: 0,
      infinity: Infinity,
    });

    // Mutate every property of the data object
    function mutate (data) {
      data.nil = NaN;
      data.notDefined = null;
      data.notANumber = undefined;
      data.bool = 1;
      data.falseBool = 0;
      data.string += "!!!";
      data.emptyString += " ";
      data.integer += 1;
      data.float -= 1;
      data.negative -= 1;
      data.zero += 1;
      data.infinity = -Infinity;
    }

    expect(mutated).to.deep.equal({
      nil: NaN,
      notDefined: null,
      notANumber: undefined,
      bool: 1,
      falseBool: 0,
      string: "Hello, world!!!",
      emptyString: " ",
      integer: 43,
      float: 2.14159,
      negative: -43,
      zero: 1,
      infinity: -Infinity,
    });
  });


  it("should serialize cloneable types", async () => {
    let originalData = {
      bool: new Boolean(),
      string: new String(),
      obj: new Object(),
      date: new Date("2005-05-05T05:05:05.005Z"),
      regex: new RegExp(/foo/),
      array: new Array(5),
      intArray: new Int32Array([-5, -4, -3]),
      uintArray: new Uint16Array([1, 2, 3, 4, 5]),
      floatArray: new Float64Array([Math.PI, Math.E]),
      set: new Set([1, 2, 3, 4, 5]),
      map: new Map([["one", 1], ["two", 2], ["three", 3]]),
    };

    let [serialized, mutated] = await testSerialization(originalData, mutate);

    expect(serialized).to.deep.equal({
      bool: new Boolean(),
      string: new String(),
      obj: new Object(),
      date: new Date("2005-05-05T05:05:05.005Z"),
      regex: new RegExp(/foo/),
      array: new Array(5),
      intArray: new Int32Array([-5, -4, -3]),
      uintArray: new Uint16Array([1, 2, 3, 4, 5]),
      floatArray: new Float64Array([Math.PI, Math.E]),
      set: new Set([1, 2, 3, 4, 5]),
      map: new Map([["one", 1], ["two", 2], ["three", 3]]),
    });

    // Make sure these didn't get converted to primitives
    expect(serialized.bool).to.be.an.instanceOf(Boolean).and.not.false;
    expect(serialized.string).to.be.an.instanceOf(String).and.not.equal("");

    // Make sure the array has a length of 5, even though no values were ever set
    expect(serialized.array).to.be.an.instanceOf(Array).with.lengthOf(5);

    // Make sure the Map and Set have the correct keys/values
    expect(serialized.map.get("one")).to.equal(1);
    expect(serialized.map.get("two")).to.equal(2);
    expect(serialized.map.get("three")).to.equal(3);
    expect(serialized.set.has(1)).to.be.true;
    expect(serialized.set.has(3)).to.be.true;
    expect(serialized.set.has(6)).to.be.false;

    // Mutate every property of the data object. Some properties are immutable (boolean, string, RegExp)
    // so they are replaced entirely. But all other properties are modified in-place.
    function mutate (data) {
      data.bool = new Boolean(true);
      data.string = new String("Hello, world");
      data.obj.foo = "bar";
      data.date.setUTCFullYear(1999);
      data.regex = new RegExp(/not foo/);
      data.array[3] = "value";
      data.intArray[1] = 100;
      data.uintArray[3] = 100;
      data.floatArray[1] = 4.2;
      data.set.add(4).add(5).add(6);
      data.map.set("two", 222).set("four", 444);
    }

    expect(mutated).to.deep.equal({
      bool: new Boolean(true),
      string: new String("Hello, world"),
      obj: new Object({ foo: "bar" }),
      date: new Date("1999-05-05T05:05:05.005Z"),
      regex: new RegExp(/not foo/),
      array: [,,, "value",, ],   // eslint-disable-line
      intArray: new Int32Array([-5, 100, -3]),
      uintArray: new Uint16Array([1, 2, 3, 100, 5]),
      floatArray: new Float64Array([Math.PI, 4.2]),
      set: new Set([1, 2, 3, 4, 5, 6]),
      map: new Map([["one", 1], ["two", 222], ["three", 3], ["four", 444]]),
    });
  });


  it("should serialize non-cloneable objects as POJOs", async () => {
    class Foo {
      constructor () {
        this.instanceProperty = 1;
      }

      get getter () {
        return this.instanceProperty + 2;
      }
    }

    Foo.prototype.protoProperty = 3;

    Object.defineProperty(Foo.prototype, "protoField", { value: 4 });

    Object.defineProperty(Foo.prototype, "protoGetter", {
      get () { return this.instanceProperty + 5; }
    });

    let originalData = {
      foo: new Foo(),
      url: new URL("http://example.com/foo/bar?baz=true#hash"),
    };

    let [serialized, mutated] = await testSerialization(originalData, mutate);

    // The objects were serialized as POJOs, not class instances
    expect(serialized.foo).not.to.be.an.instanceof(Foo);
    expect(serialized.url).not.to.be.an.instanceof(URL);

    expect(serialized).to.deep.equal({
      foo: {
        instanceProperty: 1,
        getter: 3,
        protoProperty: 3,
        protoField: 4,
        protoGetter: 6,
      },
      url: {
        protocol: "http:",
        username: "",
        password: "",
        hostname: "example.com",
        host: "example.com",
        port: "",
        origin: "http://example.com",
        pathname: "/foo/bar",
        search: "?baz=true",
        searchParams: {},
        hash: "#hash",
        href: "http://example.com/foo/bar?baz=true#hash",
      }
    });

    // Mutate properties of the data object. Note that we're able to modify read-only properties
    // here because they're copied across the thread boundary as normal writable fields.
    function mutate (data) {
      data.foo.instanceProperty = 100;
      data.foo.getter = 200;
      data.foo.protoProperty = 300;
      data.foo.protoField = 400;
      data.foo.protoGetter = 500;
      data.url = new URL("ftp://admin:letmein@abc.org:2121/subdir/file.txt");
    }

    // The objects were serialized as POJOs, not class instances
    expect(mutated.foo).not.to.be.an.instanceof(Foo);
    expect(mutated.url).not.to.be.an.instanceof(URL);

    expect(mutated).to.deep.equal({
      foo: {
        instanceProperty: 100,
        getter: 200,
        protoProperty: 300,
        protoField: 400,
        protoGetter: 500,
      },
      url: {
        protocol: "ftp:",
        username: "admin",
        password: "letmein",
        hostname: "abc.org",
        host: "abc.org:2121",
        port: "2121",
        origin: "ftp://abc.org:2121",
        pathname: "/subdir/file.txt",
        search: "",
        searchParams: {},
        hash: "",
        href: "ftp://admin:letmein@abc.org:2121/subdir/file.txt",
      }
    });
  });


  it("should serialize lists of non-cloneable objects", async () => {
    class Foo {
      constructor (value) {
        this.instanceProperty = value;
      }

      get getter () {
        return this.instanceProperty + 1;
      }
    }

    let originalData = {
      array: [new Foo(1), new Foo(2)],
      set: new Set([new Foo(3), new Foo(4)]),
      map: new Map([["five", new Foo(5)], ["six", new Foo(6)]]),
    };

    let [serialized, mutated] = await testSerialization(originalData, mutate);

    expect(serialized).to.deep.equal({
      array: [{ instanceProperty: 1, getter: 2 }, { instanceProperty: 2, getter: 3 }],
      set: new Set([{ instanceProperty: 3, getter: 4 }, { instanceProperty: 4, getter: 5 }]),
      map: new Map([["five", { instanceProperty: 5, getter: 6 }], ["six", { instanceProperty: 6, getter: 7 }]]),
    });

    function mutate (data) {
      data.array[0].instanceProperty = 2;
      data.array[1].instanceProperty = 3;
      data.set.forEach((obj) => obj.instanceProperty += 1);
      data.map.get("five").instanceProperty = 6;
      data.map.get("six").instanceProperty = 7;
    }

    expect(mutated).to.deep.equal({
      array: [{ instanceProperty: 2, getter: 2 }, { instanceProperty: 3, getter: 3 }],
      set: new Set([{ instanceProperty: 4, getter: 4 }, { instanceProperty: 5, getter: 5 }]),
      map: new Map([["five", { instanceProperty: 6, getter: 6 }], ["six", { instanceProperty: 7, getter: 7 }]]),
    });
  });


  it("should serialize errors as POJOs", async () => {
    let originalData = {
      err: new Error("Boom!"),
      typeError: new TypeError("Bad Type!"),
      errWithProps: (() => {
        let e = new Error("Boom");
        e.foo = 42;
        e.bar = /regex/;
        e.baz = new URL("http://example.com/foo/bar?baz=true#hash");
        return e;
      })(),
      onoError: ono.syntax({ foo: false, bar: [1, 2, 3]}, "Bad Syntax!"),
    };

    let [serialized] = await testSerialization(originalData);

    // Errors cannot be cloned, so they are serialized as POJOs.
    expect(serialized.err).not.to.be.an.instanceof(Error);
    expect(serialized.typeError).not.to.be.an.instanceof(Error);
    expect(serialized.errWithProps).not.to.be.an.instanceof(Error);
    expect(serialized.onoError).not.to.be.an.instanceof(Error);

    expect(serialized.err).to.deep.equal({
      name: "Error",
      message: "Boom!",
      stack: originalData.err.stack,
    });
    expect(serialized.typeError).to.deep.equal({
      name: "TypeError",
      message: "Bad Type!",
      stack: originalData.typeError.stack,
    });
    expect(serialized.errWithProps).to.deep.equal({
      name: "Error",
      message: "Boom",
      stack: originalData.errWithProps.stack,
      foo: 42,
      bar: /regex/,
      baz: {
        protocol: "http:",
        username: "",
        password: "",
        hostname: "example.com",
        host: "example.com",
        port: "",
        origin: "http://example.com",
        pathname: "/foo/bar",
        search: "?baz=true",
        searchParams: {},
        hash: "#hash",
        href: "http://example.com/foo/bar?baz=true#hash",
      }
    });
    expect(serialized.onoError).to.deep.equal({
      name: "SyntaxError",
      message: "Bad Syntax!",
      stack: originalData.onoError.stack,
      foo: false,
      bar: [1, 2, 3],
    });
  });


  it("should maintain object references when cloning", async () => {
    let foo = { name: "foo" };
    let bar = { name: "bar" };

    let originalData = {
      foo,
      bar,
      array: [foo, bar],
      set: new Set([foo, bar]),
      map: new Map([["foo", foo], ["bar", bar]]),
    };

    let [serialized, mutated] = await testSerialization(originalData, mutate);

    // The same `foo` and `bar` instances should be in each list
    expect(serialized.foo).not.to.equal(foo);
    expect(serialized.foo).to.deep.equal(foo);
    expect(serialized.bar).not.to.equal(bar);
    expect(serialized.bar).to.deep.equal(bar);
    expect(serialized.array[0]).to.equal(serialized.foo);
    expect(serialized.array[1]).to.equal(serialized.bar);
    expect(serialized.set.has(serialized.foo)).to.equal(true);
    expect(serialized.set.has(serialized.bar)).to.equal(true);
    expect(serialized.map.get("foo")).to.equal(serialized.foo);
    expect(serialized.map.get("bar")).to.equal(serialized.bar);

    // Changing the names of the objects in the Map should also change them everywhere else
    function mutate (data) {
      data.map.get("foo").name = "fooooo";
      data.map.get("bar").name = "barrrrr";
    }

    // The same `foo` and `bar` instances should be in each list
    expect(mutated.foo).to.deep.equal({ name: "fooooo" });
    expect(mutated.bar).to.deep.equal({ name: "barrrrr" });
    expect(mutated.array[0]).to.equal(mutated.foo);
    expect(mutated.array[1]).to.equal(mutated.bar);
    expect(mutated.set.has(mutated.foo)).to.equal(true);
    expect(mutated.set.has(mutated.bar)).to.equal(true);
    expect(mutated.map.get("foo")).to.equal(mutated.foo);
    expect(mutated.map.get("bar")).to.equal(mutated.bar);
  });

});

/**
 * Sends the given data across the worker thread boundary, mutates it, and then updates the original
 * data with the mutated values.
 */
async function testSerialization (data, mutate = () => undefined) {
  let engine = CodeEngine.create();
  await engine.use(
    {
      name: "File Source",
      *find () {
        yield { path: "file1.txt", metadata: data };            // <--- the original data
      },
      // eslint-disable-next-line no-new-func
      processFile: await createModule(new Function("files", "context", `
        let [file] = files;
        let { logger } = context;
        logger.log("data", { data: file.metadata });            // <--- the serialized data
        (${mutate.toString()})(file.metadata);                  // <--- mutate the data
      `)),
    }
  );

  let log = sinon.spy();
  engine.on("log", log);
  let [file] = await engine.build();

  sinon.assert.calledOnce(log);
  let serialized = log.firstCall.args[0].data;                  // <--- the un-mutated serialized data
  let mutated = file.metadata;                                  // <--- the mutated serialized data
  return [serialized, mutated];
}
