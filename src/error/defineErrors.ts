import { Err } from "../result/result.js";
import type {
	DefineErrorsReturn,
	ErrorsConfig,
	ValidatedConfig,
} from "./types.js";

/**
 * Defines a set of typed error factories using Rust-style namespaced variants.
 *
 * Each key is a short variant name (the namespace provides context). Every
 * factory returns `Err<...>` directly — ready for `trySync`/`tryAsync` catch
 * handlers. The variant name is stamped as `name` on the error object.
 *
 * @example
 * ```ts
 * const HttpError = defineErrors({
 *   Connection: ({ cause }: { cause: unknown }) => ({
 *     message: `Failed to connect: ${extractErrorMessage(cause)}`,
 *     cause,
 *   }),
 *   Response: ({ status }: { status: number; bodyMessage?: string }) => ({
 *     message: `HTTP ${status}`,
 *     status,
 *   }),
 *   Parse: ({ cause }: { cause: unknown }) => ({
 *     message: `Failed to parse response body: ${extractErrorMessage(cause)}`,
 *     cause,
 *   }),
 * });
 *
 * type HttpError = InferErrors<typeof HttpError>;
 *
 * const result = HttpError.Connection({ cause: 'timeout' }); // Err<...>
 * ```
 *
 * Inspired by Rust's {@link https://docs.rs/thiserror | thiserror} crate. The
 * mapping is nearly 1:1:
 *
 * - `enum HttpError` → `const HttpError = defineErrors(...)`
 * - Variant `Connection { cause: String }` → key `Connection: ({ cause }: { cause: unknown }) => (...)`
 * - `#[error("Failed: {cause}")]` → `` message: `Failed: ${extractErrorMessage(cause)}` ``
 * - `HttpError::Connection { ... }` → `HttpError.Connection({ ... })`
 * - `match error { Connection { .. } => }` → `switch (error.name) { case 'Connection': }`
 *
 * The equivalent Rust `thiserror` enum:
 * ```rust
 * #[derive(Error, Debug)]
 * enum HttpError {
 *     #[error("Failed to connect: {cause}")]
 *     Connection { cause: String },
 *
 *     #[error("HTTP {status}")]
 *     Response { status: u16, body_message: Option<String> },
 *
 *     #[error("Failed to parse response body: {cause}")]
 *     Parse { cause: String },
 * }
 * ```
 */
export function defineErrors<const TConfig extends ErrorsConfig>(
	config: TConfig & ValidatedConfig<TConfig>,
): DefineErrorsReturn<TConfig> {
	const result: Record<string, unknown> = {};

	for (const [name, ctor] of Object.entries(config)) {
		result[name] = (...args: unknown[]) => {
			const body = (ctor as (...a: unknown[]) => Record<string, unknown>)(
				...args,
			);
			return Err(Object.freeze({ ...body, name }));
		};
	}

	return result as DefineErrorsReturn<TConfig>;
}
