import { Ono } from "ono";

type POJO = Record<string, unknown>;

/**
 * Returns the best equivalent of the given value that can be cloned across the thread boundary.
 */
export function serialize(value: unknown, depth = 2): unknown {
  if (isCloneable(value)) {
    // This value is natively cloneable. So just return it as-is.
    return value;
  }

  if (value instanceof Error) {
    return Ono.toJSON(value);
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
    let obj = value as POJO;
    let copy: POJO = {};

    if (depth >= 0) {
      // tslint:disable-next-line: no-for-in forin
      for (let key in obj) {
        copy[key] = serialize(obj[key], depth - 1);
      }
    }

    return copy;
  }
}


/**
 * Recursively updates the properties of the target object to match the source object.
 */
export function update(target: POJO, source: POJO): POJO {
  for (let key of Object.keys(source)) {
    try {
      target[key] = getUpdatedValue(target[key], source[key]);
    }
    catch (error) {
      // Ignroe errors from trying to set read-only properties
      if ((error as Error).message !== "not writeable") {
        throw error;
      }
    }
  }

  return target;
}


/**
 * Either returns the old value, updates the old value, or returns the new value.
 */
function getUpdatedValue(oldValue: unknown, newValue: unknown): unknown {
  if (isCloneable(oldValue)) {
    /**
     * The old value was cloneable, which means either:
     *  A) The new value is the same type, so it can be used as-is
     * - or -
     *  B) The new value is a different type, so we should replace the old value
     */
    return newValue;
  }

  if (Array.isArray(oldValue)) {
    if (!Array.isArray(newValue)) {
      // The array has been replaced with something else
      return newValue;
    }

    // Clear the array and add items back into it one-by-one
    let oldItems = oldValue.slice();
    oldValue.splice(0, oldValue.length);

    for (let i = 0; i < newValue.length; i++) {
      oldValue.push(getUpdatedValue(oldItems[i], newValue[i]));
    }

    return oldValue;
  }

  if (oldValue instanceof Set) {
    if (newValue instanceof Set) {
      // This set contains non-cloneable values, so we can't update it
      return oldValue;
    }
    else {
      // The set has been replaced with something else
      return newValue;
    }
  }

  if (oldValue instanceof Map) {
    if (newValue instanceof Map) {
      // This map contains non-cloneable keys/values, so we can't update it
      return oldValue;
    }
    else {
      // The map has been replaced with something else
      return newValue;
    }
  }

  if (typeof oldValue === "object") {
    if (!newValue || typeof newValue !== "object") {
      // The old value has been replaced with a primitive value
      return newValue;
    }
    else if (Array.isArray(newValue) || newValue instanceof Set || newValue instanceof Map) {
      // The old value has been replaced with an Array, Set, or Map
      return newValue;
    }

    // The new value is also an object, so update each of its properties
    return update(oldValue as POJO, newValue as POJO);
  }

  // This is a type that we can't update. So leave the value as-is.
  return oldValue;
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
function isCloneable(value: unknown): boolean | undefined {
  if (!value
  || primitives.includes(typeof value)
  || cloneable.some((type) => value instanceof type)) {
    // This value is natively cloneable. So just return it as-is.
    return true;
  }

  if (Array.isArray(value)) {
    return value.every(isCloneable);
  }

  if (value instanceof Set) {
    let values = [...value];
    return values.every(isCloneable);
  }

  if (value instanceof Map) {
    let entries = [...value];
    return entries.every(([k, v]) => isCloneable(k) && isCloneable(v));
  }
}
