import type { AnyTaggedError } from "../error/types.js";
import { consoleSink } from "./console-sink.js";
import type { LoggableError, LogLevel, Logger, LogSink } from "./types.js";

/** Narrow `LoggableError` to the raw tagged object. See `LoggableError` in `types.ts` for the discriminator rationale. */
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
 * ### Source convention
 *
 * `source` is a free-form string, but downstream filtering and tail-log
 * grep become much easier when call sites converge on a shape. Recommended:
 *
 *     '<package>/<module>'    e.g. 'workspace/sync-supervisor'
 *     '<app>/<feature>'       e.g. 'fuji/daemon-route'
 *     '<package>/<area>'      e.g. 'auth/oauth-app'
 *
 * Keep it lowercase-kebab. Avoid bare factory names like
 * `'attachSqliteMaterializer'`: they don't carry package context.
 *
 * ### Module-scope vs injected
 *
 * `const log = createLogger('source')` at module scope is fine for
 * process-singleton modules (CLI commands, app bootstrap, leaf utilities
 * the host does not customize per instance). For anything that can be
 * instantiated more than once per process with different routing needs
 * (per-document attach primitives, per-account auth state, per-workspace
 * services), accept `log?: Logger` at the factory boundary and default
 * to `createLogger('source')` for development ergonomics.
 *
 * @example Library code (caller wires the sink)
 * function attachThing(ydoc: Doc, opts: { log?: Logger }) {
 *   const log = opts.log ?? createLogger('workspace/thing');
 *   // ...
 * }
 *
 * @example App wiring (share one sink, multiple loggers)
 * const sink = composeSinks(consoleSink, myCustomSink);
 * attachThing(ydoc, { log: createLogger('workspace/thing', sink) });
 * attachOther(ydoc, { log: createLogger('workspace/other', sink) });
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
