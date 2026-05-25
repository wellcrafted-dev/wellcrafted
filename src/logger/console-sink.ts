import type { LogSink } from "./types.js";

/**
 * Default sink. Writes to `console.*` with a `[source]` prefix.
 *
 * Kept as a singleton value (not a factory) because it takes no config —
 * adding `createConsoleSink({ format })` would be ceremony for a pattern
 * the user can trivially replace by writing their own sink.
 *
 * `console[event.level]` routes directly without a detached lookup table.
 * `LogLevel` is a subset of the Console method keys, so TS errors at this
 * access if a future level drifts (e.g. adding `fatal`). Calling the method
 * through `console[...]` preserves the `this` binding — avoids "Illegal
 * invocation" in runtimes that require it.
 *
 * `satisfies LogSink` (not `: LogSink`) keeps the inferred callable type
 * precise — `LogSink` is an intersection with optional dispose, and the
 * annotation form would widen an unnecessary Partial into the value type.
 *
 * No dispose handler — `console` is not a resource.
 *
 * ### CLI authors: stream routing
 *
 * `console[level]` routes by level, not uniformly to stdout:
 * - `console.log` (not used here) is the only method that writes stdout.
 * - `console.info`, `console.debug`, `console.warn`, `console.error`,
 *   `console.trace` all write **stderr** in Node/Bun.
 *
 * For a CLI that emits structured program output on stdout and diagnostics
 * on stderr, this default is correct — every logger event goes to stderr.
 * Authors who expect `log.info` to print to stdout will be surprised; write
 * a custom sink that routes to `process.stdout` if that's the requirement.
 */
export const consoleSink = ((event) => {
	const prefix = `[${event.source}]`;
	if (event.data === undefined) {
		console[event.level](prefix, event.message);
	} else {
		console[event.level](prefix, event.message, event.data);
	}
}) satisfies LogSink;
