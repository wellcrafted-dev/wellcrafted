import type { LogEvent, LogSink } from "./types.js";

/**
 * In-memory sink for tests. Returns `{ sink, events }` so callers can
 * both wire the sink and inspect captured events without a module-level
 * spy or `console.*` interception.
 *
 * A factory (not a singleton) so each test gets an isolated array; sharing
 * state across tests would leak events.
 *
 * Returning `{ sink, events }` (rather than an array with a method) keeps
 * the two roles separate — `sink` goes to `createLogger`, `events` goes to
 * assertions.
 *
 * Uses `satisfies LogSink` on the sink expression rather than `: LogSink =`
 * to preserve the precise inferred callable type.
 *
 * @example
 * const { sink, events } = memorySink();
 * const log = createLogger("test", sink);
 * log.warn(MyError.Thing({ cause: new Error("boom") }));
 * expect(events).toHaveLength(1);
 * expect(events[0]).toMatchObject({ level: "warn", source: "test" });
 */
export function memorySink(): { sink: LogSink; events: LogEvent[] } {
	const events: LogEvent[] = [];
	const sink = ((event) => {
		events.push(event);
	}) satisfies LogSink;
	return { sink, events };
}
