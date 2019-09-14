import { Ono } from "ono";

const objectPrototype = Object.getPrototypeOf({});
const defaultDepth = 5;

type POJO = Record<string, unknown>;

/**
 * Returns the best equivalent of the given value that can be cloned across the thread boundary.
 */
export function serialize(value: unknown, depth = defaultDepth): unknown {
  if (isCloneable(value, depth)) {
    // This value is natively cloneable. So just return it as-is.
    return value;
  }

  if (value instanceof Error) {
    return serialize(Ono.toJSON(value));
  }

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item, depth));
  }

  if (value instanceof Map) {
    let copy = new Map();
    for (let [k, v] of value.entries()) {
      copy.set(serialize(k, depth), serialize(v, depth));
    }
    return copy;
  }

  if (value instanceof Set) {
    let copy = new Set();
    for (let v of value.values()) {
      copy.add(serialize(v, depth));
    }
    return copy;
  }

  if (typeof value === "object") {
    let copy: POJO = {};

    for (let key of getPropertyNames(value)) {
      let prop = (value as POJO)[key];
      copy[key] = depth > 0 ? serialize(prop, depth - 1) : undefined;
    }

    return copy;
  }
}

const primitives = ["string", "number", "boolean", "bigint"];
const cloneable = [
  Boolean, String, Date, RegExp, ArrayBuffer, DataView, Int8Array, Int16Array, Int32Array,
  Uint8Array, Uint8ClampedArray, Uint16Array, Uint32Array, Float32Array, Float64Array
];

/**
 * Determines whether the given value can be cloned natively, meaning that we don't have to
 * serialize it ourselves.
 */
function isCloneable(value: unknown, depth: number): boolean | undefined {
  if (!value
  || primitives.includes(typeof value)
  || cloneable.some((type) => value instanceof type)) {
    // This value is natively cloneable. So just return it as-is.
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((item) => isCloneable(item, depth));
  }

  if (value instanceof Set) {
    return [...value].every((item) => isCloneable(item, depth));
  }

  if (value instanceof Map) {
    return [...value].every(([k, v]) => isCloneable(k, depth) && isCloneable(v, depth));
  }

  if (typeof value === "object") {
    let proto = Object.getPrototypeOf(value);
    if (proto !== null && proto !== objectPrototype) {
      // This isn't a POJO
      return false;
    }

    if (depth > 0) {
      for (let key of getPropertyNames(value)) {
        if (!isCloneable((value as POJO)[key], depth - 1)) {
          return false;
        }
      }

      // All properties of this object are cloneable
      return true;
    }
  }
}

/**
 * Returns the own and inherited property names of the given object.
 */
function getPropertyNames(obj: object | null): string[] {
  let keys = [];
  let proto = obj;

  // Crawl the prototype chain to get all keys
  while (proto && proto !== objectPrototype) {
    for (let key of Object.getOwnPropertyNames(proto)) {
      // Ignore methods, since functions aren't cloneable
      if (typeof (obj as POJO)[key] !== "function") {
        keys.push(key);
      }
    }

    proto = Object.getPrototypeOf(proto) as object | null;
  }

  return keys;
}
