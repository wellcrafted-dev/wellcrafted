/**
 * Structured, level-keyed logger for libraries that use `defineErrors`.
 *
 * - 5 levels (trace/debug/info/warn/error), no `fatal`.
 * - `warn`/`error` take a typed error unary; `info`/`debug`/`trace` are
 *   free-form.
 * - Level is a call-site decision, never a property of the error variant.
 * - DI-only — no global registry, no default logger singleton.
 *
 * The entry has no Bun/Node-only sink implementation, but its `LogSink` type
 * and `composeSinks` cleanup use `AsyncDisposable` and `Symbol.asyncDispose`.
 * Consumers need matching type libraries and runtime support for disposal.
 */
export type {
	LogEvent,
	LogLevel,
	LogSink,
	Logger,
	LoggableError,
} from "./types.js";
export { consoleSink } from "./console-sink.js";
export { createLogger } from "./create-logger.js";
export { memorySink } from "./memory-sink.js";
export { composeSinks } from "./compose-sinks.js";
export { tapErr } from "../result/tap-err.js";
