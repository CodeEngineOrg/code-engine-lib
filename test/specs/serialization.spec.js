"use strict";

const CodeEngine = require("../utils/code-engine");
const { createModule } = require("../utils/utils");
const { expect } = require("chai");
const sinon = require("sinon");
const ono = require("ono");

describe("Worker serialization", () => {

  it("should serialize primitives", async () => {
    let input = {
      nil: null,
      notDefined: undefined,
      notANumber: NaN,
      bool: true,
      falseBool: false,
      string: "Hello, world!",
      emptyString: "",
      integer: 42,
      float: 3.14159,
      negative: -42,
      zero: 0,
      infinity: Infinity,
    };

    let output = await testSerialization(input);
    expect(output).to.deep.equal(input);

    // Make sure it has all the same keys, even null/undefined/falsy ones
    expect(output).to.have.same.keys(Object.keys(input));
  });

  it("should serialize cloneable types", async () => {
    let input = {
      bool: new Boolean(),      // eslint-disable-line no-new-wrappers
      string: new String(),     // eslint-disable-line no-new-wrappers
      obj: new Object(),        // eslint-disable-line no-new-object
      date: new Date(),
      regex: new RegExp(/foo/),
      array: new Array(5),
      intArray: new Int32Array([-5, -4, -3]),
      uintArray: new Uint16Array([1, 2, 3, 4, 5]),
      floatArray: new Float64Array([Math.PI, Math.E]),
      set: new Set([1, 2, 3, 4, 5]),
      map: new Map([["one", 1], ["two", 2], ["three", 3]]),
    };

    let output = await testSerialization(input);
    expect(output).to.deep.equal(input);

    // Make sure these didn't get converted to primitives
    expect(output.bool).to.be.an.instanceOf(Boolean).and.not.false;
    expect(output.string).to.be.an.instanceOf(String).and.not.equal("");

    // Make sure the array has a length of 5, even though no values were ever set
    expect(output.array).to.be.an.instanceOf(Array).with.lengthOf(5);

    // Make sure the Map and Set have the correct keys/values
    expect(output.map.get("one")).to.equal(1);
    expect(output.map.get("two")).to.equal(2);
    expect(output.map.get("three")).to.equal(3);
    expect(output.set.has(1)).to.be.true;
    expect(output.set.has(3)).to.be.true;
    expect(output.set.has(6)).to.be.false;
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

    let input = {
      foo: new Foo(),
      url: new URL("http://example.com/foo/bar?baz=true#hash"),
    };

    let output = await testSerialization(input);
    expect(output).to.deep.equal({
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
  });

  it("should serialize errors as POJOs", async () => {
    let input = {
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

    let output = await testSerialization(input);
    expect(output.err).to.deep.equal({
      name: "Error",
      message: "Boom!",
      stack: input.err.stack,
    });
    expect(output.typeError).to.deep.equal({
      name: "TypeError",
      message: "Bad Type!",
      stack: input.typeError.stack,
    });
    expect(output.errWithProps).to.deep.equal({
      name: "Error",
      message: "Boom",
      stack: input.errWithProps.stack,
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
    expect(output.onoError).to.deep.equal({
      name: "SyntaxError",
      message: "Bad Syntax!",
      stack: input.onoError.stack,
      foo: false,
      bar: [1, 2, 3],
    });
  });

});

/**
 * Sends the given data across the worker thread boundary and back, then returns it.
 */
async function testSerialization (data) {
  let engine = CodeEngine.create();
  await engine.use(
    {
      name: "File Source",
      *find () {
        yield { path: "file1.txt", metadata: data };
      },
    },
    {
      moduleId: await createModule(`
        module.exports = () => {
          return {
            name: "Worker Plugin",
            processFile (file, { logger }) {
              logger.log("data", { data: file.metadata });
            }
          };
        };
      `),
    }
  );

  let log = sinon.spy();
  engine.on("log", log);
  await engine.build();

  sinon.assert.calledOnce(log);
  return log.firstCall.args[0].data;
}
