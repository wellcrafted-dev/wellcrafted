import type { AnyTaggedError } from "../error/types.js";
import type { Err } from "../result/result.js";

/**
 * Five levels, no `fatal`. Matches Rust's `tracing` exactly.
 *
 * Process termination is the application's call, not the library's — so
 * there is no `fatal`. Apps that want to exit on a specific error do so
 * explicitly (`process.exit`, `Bun.exit`) at the call site.
 */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

/**
 * The normalized event every sink receives.
 *
 * - `ts` is epoch millis (not a `Date`) — cheap to create, easy to serialize,
 *   trivially monotonic for ordering. Sinks that want ISO-8601 on the wire
 *   convert at serialization time.
 * - `source` is the logger's namespace, stamped once at `createLogger` and
 *   carried on every event. Analogous to `tracing`'s `target`.
 * - `message` is human text. For `warn`/`error` it's copied from the
 *   typed error's `message` field (so `event.message === event.data.message`
 *   on those levels — intentional duplication so sinks have one uniform
 *   rendering path regardless of event origin; they never need to know
 *   whether `data` is a tagged error or free-form payload). The variant
 *   template owns the phrasing; sinks just render.
 * - `data` carries the structured payload. For `warn`/`error` it's the
 *   typed error object itself (including `name` + captured fields). For
 *   `info`/`debug`/`trace` it's free-form, caller-supplied.
 */
export type LogEvent = {
	ts: number;
	level: LogLevel;
	source: string;
	message: string;
	data?: unknown;
};

/**
 * A sink is a callable that accepts events, with optional resource cleanup.
 *
 * The intersection with `Partial<AsyncDisposable>` lets the same type cover
 * both pure functions (no-op dispose) and stateful sinks (file writers,
 * network sockets). Callers who need guaranteed cleanup narrow to a
 * `LogSink & AsyncDisposable` return type or bind with `await using`.
 */
export type LogSink = ((event: LogEvent) => void) & Partial<AsyncDisposable>;

/**
 * Accepted by `log.warn` / `log.error`. Union of two shapes:
 *
 * - `AnyTaggedError` — the raw tagged error `{ name, message, ...fields }`.
 *   Arrives via `result.error` after narrowing a Result.
 * - `Err<AnyTaggedError>` — the `{ error: tagged, data: null }` wrapper
 *   that `defineErrors` factories return directly.
 *
 * The logger unwraps via `"name" in err` inside `unwrapLoggable` — a
 * purely structural discriminator:
 *
 * - `AnyTaggedError` always has `name` at the top level (stamped by
 *   `defineErrors` from the factory key — a hard invariant of every
 *   tagged error).
 * - `Err<AnyTaggedError>` has exactly `{ error, data }` at the top level.
 *   The tagged error's `name` lives on `err.error.name`, not `err.name`.
 *
 * Intentionally **not** checking `err.data === null`: that's also true for
 * `Ok(T)` when `T = null` (see wellcrafted's `Ok(null)`/`Err(null)`
 * structural collision edge — discussed in
 * `docs/articles/ok-null-is-fine-err-null-is-a-lie.md`). Always discriminate
 * by an invariant non-null property (`name` here), never by null-presence.
 *
 * @example Err-wrapped (direct mint)
 * log.warn(MyError.Thing({ cause }));
 *
 * @example Raw tagged (from result.error, after narrowing)
 * if (isErr(result)) log.warn(result.error);
 */
export type LoggableError = AnyTaggedError | Err<AnyTaggedError>;

/**
 * The logger surface.
 *
 * Shape split is intentional:
 * - `warn`/`error` take a typed error **unary** — message and structured
 *   data both live on the variant, level is chosen at the call site.
 * - `trace`/`debug`/`info` are free-form — diagnostic events don't need
 *   enumeration and often don't have a useful "name" to dedupe on.
 *
 * Mirrors Rust's `tracing::warn!(?err)` vs `tracing::info!("msg", ...)`.
 */
export type Logger = {
	error(err: LoggableError): void;
	warn(err: LoggableError): void;
	info(message: string, data?: unknown): void;
	debug(message: string, data?: unknown): void;
	trace(message: string, data?: unknown): void;
};
