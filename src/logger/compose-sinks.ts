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
 * Each member completes synchronous receipt in order. A throwing member
 * is reported directly to the console without skipping later members.
 * Returned values are ignored; promise-returning receivers are unsupported.
 * A single member uses the same delivery guard as multiple members.
 *
 * Dispose is sequential and awaits each member. If one throws, later
 * members don't get their chance; callers who want best-effort cleanup
 * should wrap the composed dispose themselves.
 *
 * @example
 * await using file = jsonlFileSink("/tmp/app.jsonl");
 * const sink = composeSinks(consoleSink, file);
 * const log = createLogger("source", sink);
 */
export function composeSinks(...sinks: LogSink[]): LogSink {
	const emit = (event: LogEvent): undefined => {
		for (const sink of sinks) {
			try {
				sink(event);
			} catch (cause) {
				try {
					console.error("[wellcrafted/logger] Sink failed", cause, event);
				} catch {
					// Emergency output must not interrupt application work or later sinks.
				}
			}
		}
	};
	const dispose = async (): Promise<void> => {
		for (const sink of sinks) await sink[Symbol.asyncDispose]?.();
	};
	return Object.assign(emit, {
		[Symbol.asyncDispose]: dispose,
	}) satisfies LogSink;
}
