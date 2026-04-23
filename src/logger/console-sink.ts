import type { LogLevel, LogSink } from "./types.js";

/**
 * Level-to-method map for the default sink.
 *
 * A record lookup (rather than a switch) gives us exhaustive checking via
 * `satisfies Record<LogLevel, ...>` — if `LogLevel` gains a case, TS errors
 * here until the map covers it. A switch would fall through silently.
 */
const CONSOLE_FN = {
	error: console.error,
	warn: console.warn,
	info: console.info,
	debug: console.debug,
	trace: console.trace,
} satisfies Record<LogLevel, (...args: unknown[]) => void>;

/**
 * Default sink. Writes to `console.*` with a `[source]` prefix.
 *
 * Kept as a singleton value (not a factory) because it takes no config —
 * adding `createConsoleSink({ format })` would be ceremony for a pattern
 * the user can trivially replace by writing their own sink.
 *
 * The level-to-method mapping matches the legacy `console.*` call shape so
 * migrating from `console.warn('[src] ...', err)` to `log.warn(err)` is a
 * visible no-op in dev tools.
 *
 * `satisfies LogSink` (not `: LogSink`) keeps the inferred callable type
 * precise — `LogSink` is a union with optional dispose, and the annotation
 * form would widen an unnecessary Partial into the inferred value type.
 *
 * No dispose handler — `console` is not a resource.
 */
export const consoleSink = ((event) => {
	const prefix = `[${event.source}]`;
	const args =
		event.data === undefined
			? [prefix, event.message]
			: [prefix, event.message, event.data];
	CONSOLE_FN[event.level](...args);
}) satisfies LogSink;
