/**
 * Structured, level-keyed logger for libraries that use `defineErrors`.
 *
 * - 5 levels (trace/debug/info/warn/error), no `fatal`.
 * - `warn`/`error` take a typed error unary; `info`/`debug`/`trace` are
 *   free-form.
 * - Level is a call-site decision, never a property of the error variant.
 * - DI-only — no global registry, no default logger singleton.
 *
 * Runtime-agnostic. The browser-safe bits live here. Bun/Node-only sinks
 * (e.g. a JSONL file appender) ship downstream so this entry stays pure.
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
