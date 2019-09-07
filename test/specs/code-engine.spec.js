"use strict";

const { CodeEngine } = require("../../lib");
const { expect } = require("chai");

describe("CodeEngine class", () => {

  it("should work without any arguments", async () => {
    let engine;

    try {
      engine = new CodeEngine();
      expect(engine).to.be.an("object");
    }
    finally {
      engine && await engine.dispose();
    }
  });

  it("should work with an empty configuration", async () => {
    let engine;

    try {
      engine = new CodeEngine({});
      expect(engine).to.be.an("object");
    }
    finally {
      engine && await engine.dispose();
    }
  });

  it("should ignore unknown configuration properties", async () => {
    let engine;

    try {
      engine = new CodeEngine({ foo: true, bar: 5 });
      expect(engine).to.be.an("object");
    }
    finally {
      engine && await engine.dispose();
    }
  });

  it('should not work without the "new" keyword', () => {
    function withoutNew () {
      // eslint-disable-next-line new-cap
      return CodeEngine();
    }

    expect(withoutNew).to.throw(TypeError);
    expect(withoutNew).to.throw("Class constructor CodeEngine cannot be invoked without 'new'");
  });

});
