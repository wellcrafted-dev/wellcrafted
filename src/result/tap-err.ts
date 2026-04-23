import { isErr } from "./result.js";
import type { Result } from "./result.js";

/**
 * Result-flow combinator. Logs on the `Err` branch and returns the `Result`
 * unchanged. Mirrors Rust's `Result::inspect_err` and Effect's
 * `tapErrorCause`.
 *
 * Takes a log **method**, not a whole logger. The caller picks the level at
 * the pipeline site — the same typed error can be logged as `warn` inside a
 * retry loop and as `error` on the last attempt, without the variant itself
 * carrying level. This is the `tracing::warn!(?err)` vs
 * `tracing::error!(?err)` idiom translated to Result-flow.
 *
 * No message argument. The typed error owns its message; a message
 * parameter here would drift away from the variant's template over time.
 *
 * @example
 * const result = await tryAsync({
 *   try: () => writeTable(path),
 *   catch: (cause) => MarkdownError.TableWrite({ path, cause }),
 * }).then(tapErr(log.warn));
 *
 * @example Level chosen at call site
 * await tryAttempt().then(tapErr(log.warn));  // inside retry
 * await tryFinal().then(tapErr(log.error));   // last try, giving up
 */
export function tapErr<T, E>(
	logFn: (err: E) => void,
): (result: Result<T, E>) => Result<T, E> {
	return (result) => {
		if (isErr(result)) logFn(result.error);
		return result;
	};
}
