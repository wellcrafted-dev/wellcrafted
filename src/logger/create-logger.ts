import type { AnyTaggedError } from "../error/types.js";
import { consoleSink } from "./console-sink.js";
import type { LoggableError, LogLevel, Logger, LogSink } from "./types.js";

/**
 * Narrow `LoggableError` to the raw tagged object.
 *
 * Discriminator: `"name" in err`.
 * - `AnyTaggedError` always has `name` at the top level (required by
 *   `defineErrors`, stamped from the factory key — the one guaranteed
 *   invariant of every tagged error).
 * - `Err<AnyTaggedError>` has exactly `{ error, data }` at the top level.
 *   No top-level `name` — that lives on `err.error.name` instead.
 *
 * Purely structural. No null-checks. Works without the `data` reservation
 * in `defineErrors` (though that reservation is still good policy for
 * other code that wants to discriminate Err-wrapped vs raw tagged).
 *
 * Intentionally avoids `err.data === null` — that would *also* be true for
 * `Ok(T | null)` when T = null (see wellcrafted's `Ok(null)`/`Err(null)`
 * structural collision edge), making it a misleading pattern outside this
 * specific context.
 */
function unwrapLoggable(err: LoggableError): AnyTaggedError {
	return "name" in err ? err : err.error;
}

/**
 * Create a logger bound to a `source` namespace and a sink.
 *
 * Design choices:
 * - **Positional args, not a bag.** Two arguments, both with obvious meaning;
 *   a `{ source, sink }` object would be ceremony.
 * - **`sink` defaults to `consoleSink`.** Most callers during development
 *   want console output with zero setup. Production apps swap it out via DI
 *   at the attach/wire-up site.
 * - **No global default logger.** There is no `setDefaultLogger()` and no
 *   module-level registry. Every consumer takes a `log?: Logger` option
 *   and defaults to `createLogger('<source>')` if omitted. Globals make
 *   test isolation and sink composition painful.
 * - **Method shorthand in the return object** over higher-order factories.
 *   The five methods differ in two simple ways (error-unary vs free-form,
 *   plus the level string); spelling them out beats an `emitErr("warn")`
 *   riddle.
 *
 * @example Library code (caller wires the sink)
 * function attachThing(ydoc: Doc, opts: { log?: Logger }) {
 *   const log = opts.log ?? createLogger('thing');
 *   // ...
 * }
 *
 * @example App wiring (share one sink, multiple loggers)
 * await using file = jsonlFileSink('/var/log/app.jsonl');
 * const sink = composeSinks(consoleSink, file);
 * attachThing(ydoc, { log: createLogger('thing', sink) });
 * attachOther(ydoc, { log: createLogger('other', sink) });
 */
export function createLogger(
	source: string,
	sink: LogSink = consoleSink,
): Logger {
	const emit = (level: LogLevel, message: string, data?: unknown): void => {
		sink({ ts: Date.now(), level, source, message, data });
	};
	return {
		error(err) {
			const tagged = unwrapLoggable(err);
			emit("error", tagged.message, tagged);
		},
		warn(err) {
			const tagged = unwrapLoggable(err);
			emit("warn", tagged.message, tagged);
		},
		info(message, data) {
			emit("info", message, data);
		},
		debug(message, data) {
			emit("debug", message, data);
		},
		trace(message, data) {
			emit("trace", message, data);
		},
	};
}
