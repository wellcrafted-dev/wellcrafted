import type { LogSink } from "./types.js";

/**
 * Default sink. Writes to `console.*` with a `[source]` prefix.
 *
 * Kept as a singleton value (not a factory) because it takes no config —
 * adding `createConsoleSink({ format })` would be ceremony for a pattern
 * the user can trivially replace by writing their own sink.
 *
 * Trace uses `console.debug`: `console.trace` would add a stack trace to
 * every event. Other levels use the corresponding console method. Calling
 * through `console[...]` preserves the receiver binding.
 *
 * `satisfies LogSink` (not `: LogSink`) keeps the inferred callable type
 * precise — `LogSink` is an intersection with optional dispose, and the
 * annotation form would widen an unnecessary Partial into the value type.
 *
 * No dispose handler — `console` is not a resource.
 *
 * ### CLI authors: stream routing
 *
 * In Node/Bun, info, debug, and trace write to stdout; warn and error
 * write to stderr. Console rendering is human-readable text, not JSONL.
 *
 * A CLI reserving stdout for program output needs a sink that explicitly
 * writes every event to stderr.
 */
export const consoleSink = ((event) => {
	const prefix = `[${event.source}]`;
	const method = event.level === "trace" ? "debug" : event.level;
	if (event.data === undefined) {
		console[method](prefix, event.message);
	} else {
		console[method](prefix, event.message, event.data);
	}
}) satisfies LogSink;
