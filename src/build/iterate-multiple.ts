import { ono } from "ono";
import { AnyIterator, CanIterate } from "../plugins";

type IteratorAndResult<T> = [AnyIterator<T>, IteratorResult<T>];

/**
 * Combines multiple async iterators into a single one that returns all the combined results
 * in first-available order.
 */
export function iterateMultiple<T>(iterables: Array<CanIterate<T>>): AsyncIterableIterator<T> {
  let pending = new Map<AnyIterator<T>, Promise<IteratorAndResult<T>>>();

  return {
    [Symbol.asyncIterator]() {
      // Start iterating over all of the iterables
      for (let iterable of iterables) {
        let iterator = getIterator(iterable);
        pending.set(iterator, next(iterator));
      }

      return this;
    },

    async next(): Promise<IteratorResult<T>> {
      while (pending.size > 0) {
        let [iterator, result] = await Promise.race(pending.values());

        if (result.done) {
          // Remove this iterator from the pending list
          pending.delete(iterator);
        }
        else {
          // Start fetching the next result
          pending.set(iterator, next(iterator));

          // Return the current result
          return result;
        }
      }

      // All of the iterators are done
      return ({ done: true, value: undefined as unknown as T });
    }
  };
}

/**
 * Returns the iterator for the given iterable.
 */
function getIterator<T>(canIterate: CanIterate<T>): AnyIterator<T> {
  let iterator = canIterate as AnyIterator<T>;
  let syncIterable = canIterate as Iterable<T>;
  let asyncIterable = canIterate as AsyncIterable<T>;

  if (typeof asyncIterable[Symbol.asyncIterator] === "function") {
    return asyncIterable[Symbol.asyncIterator]();
  }
  else if (typeof syncIterable[Symbol.iterator] === "function") {
    return syncIterable[Symbol.iterator]();
  }
  else if (typeof iterator.next === "function") {
    return iterator;
  }
  else {
    throw ono.type(`CodeEngine requires an iterable, such as an array, Map, Set, or generator.`);
  }
}

/**
 * Returns the next result from the given async iterator, along with the iterator itself.
 */
async function next<T>(iterator: AnyIterator<T>): Promise<IteratorAndResult<T>> {
  let result = await iterator.next();
  return [iterator, result];
}
