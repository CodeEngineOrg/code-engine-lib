import { AnyIterator } from "../plugins/types";

/**
 * A function that returns an iterable list of results from a source.
 */
export type Mapper<TSource, TResult> = (source: TSource) => AnyIterator<TResult>;

/**
 * Combines multiple async iterators into a single one that returns all the combined results
 * in first-available order.
 *
 * @param sources - The sources that will provide the iterators
 * @param mapper - A function that gets the iterator for each source
 *
 * @returns - An async iterator that yields tuples of each result and its corresponding source
 */
export function iterateMultiple<TSource, TResult>(sources: TSource[], mapper: Mapper<TSource, TResult>)
: AsyncIterableIterator<[TSource, TResult]> {
  let pending = new Map<TSource, Promise<SourceIteratorResult<TSource, TResult>>>();

  return {
    [Symbol.asyncIterator]() {
      // Start iterating over all of the iterables
      let iterators = sources.map(mapper);
      for (let [index, iterator] of iterators.entries()) {
        let source = sources[index];
        pending.set(source, next(source, iterator));
      }

      return this;
    },

    async next(): Promise<IteratorResult<[TSource, TResult]>> {
      while (pending.size > 0) {
        let result = await Promise.race(pending.values());

        if (result.done) {
          // Remove this iterator from the pending list
          pending.delete(result.source);
        }
        else {
          // Start fetching the next result
          pending.set(result.source, next(result.source, result.iterator));

          // Return the current result
          return {
            value: [result.source, result.value]
          };
        }
      }

      // All of the iterators are done
      return ({ done: true, value: undefined as unknown as TResult });
    }
  };
}

type SourceIteratorResult<TSource, TResult> = IteratorResult<TResult> & {
  source: TSource;
  iterator: AnyIterator<TResult>;
};

/**
 * Returns the next result from the given async iterator, along with the iterator itself.
 */
async function next<TSource, TResult>(source: TSource, iterator: AnyIterator<TResult>)
: Promise<SourceIteratorResult<TSource, TResult>> {
  let result = await iterator.next() as SourceIteratorResult<TSource, TResult>;
  result.source = source;
  result.iterator = iterator;
  return result;
}
