import type { LogEvent, LogSink } from "./types.js";

/**
 * Fan one event out to every sink in order.
 *
 * Disposal: the returned sink has a `[Symbol.asyncDispose]` that forwards
 * to each member via optional chaining. Members without dispose (e.g.
 * `consoleSink`) are silent no-ops; members that own resources (file,
 * network) flush and close. Mix pure and stateful sinks freely — no
 * wrapping required.
 *
 * Dispose is sequential and awaits each member. If one throws, later
 * members don't get their chance; callers who want best-effort cleanup
 * should wrap the composed dispose themselves.
 *
 * Built with `Object.assign` + `satisfies LogSink` rather than mutating a
 * pre-typed `const` — avoids the widening that comes with `: LogSink =` and
 * keeps the inferred type precise (callable + definite dispose, not
 * callable + Partial dispose).
 *
 * @example
 * await using file = jsonlFileSink("/tmp/app.jsonl");
 * const sink = composeSinks(consoleSink, file);
 * const log = createLogger("source", sink);
 */
export function composeSinks(...sinks: LogSink[]): LogSink {
	const emit = (event: LogEvent) => {
		for (const sink of sinks) sink(event);
	};
	const dispose = async (): Promise<void> => {
		for (const sink of sinks) await sink[Symbol.asyncDispose]?.();
	};
	return Object.assign(emit, {
		[Symbol.asyncDispose]: dispose,
	}) satisfies LogSink;
}
