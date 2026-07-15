/**
 * Run-at-most-once wrapper. Wrap `fn` so the first call invokes it and caches the result;
 * every later call is a no-op that returns that same cached result. Arguments passed after
 * the first call are ignored. If the first call throws, later calls rethrow that same value
 * without invoking `fn` again.
 *
 * Canonical use: an idempotent `[Symbol.dispose]` whose teardown is reachable from more than
 * one path and must not run twice. `once` makes that guarantee declarative instead of a
 * hand-rolled `let disposed` flag.
 *
 * This is for the pure "this function body runs at most once" case. A boolean that is ALSO
 * read by other methods to short-circuit a dead object is a liveness flag, not a once-guard;
 * keep that boolean, `once` does not replace it.
 *
 * @example
 * ```ts
 * import { once } from "wellcrafted/function";
 *
 * const init = once(() => expensiveSetup());
 * init(); // runs expensiveSetup()
 * init(); // returns the cached result, does not run again
 * ```
 *
 * @example Idempotent disposal
 * ```ts
 * import { once } from "wellcrafted/function";
 *
 * const dispose = once(() => closeConnection());
 * // safe to call from multiple teardown paths; closeConnection() runs at most once
 * ```
 */
export function once<TArgs extends readonly unknown[], TReturn>(
	fn: (...args: TArgs) => TReturn,
): (...args: TArgs) => TReturn {
	let called = false;
	let failed = false;
	let thrown: unknown;
	let result: TReturn;
	return (...args: TArgs): TReturn => {
		if (!called) {
			called = true;
			try {
				result = fn(...args);
			} catch (error) {
				failed = true;
				thrown = error;
				throw error;
			}
		}
		if (failed) throw thrown;
		return result;
	};
}
