import { Err } from "../result/result.js";
import type { ErrorBody } from "./types.js";

// =============================================================================
// Config types
// =============================================================================

/** Config: each key maps to `[httpStatus, factory]`. */
// biome-ignore lint/suspicious/noExplicitAny: required for TypeScript's function type inference
export type HttpErrorsConfig = Record<string, [number, (...args: any[]) => ErrorBody]>;

/**
 * Per-key validation applied to the factory portion of each tuple.
 * Mirrors `ValidatedConfig` from `defineErrors`: prevents `name` in the
 * factory return body since the factory key is stamped as `name`.
 */
type ValidateHttpErrorBody<K extends string> = {
	message: string;
	name?: `The 'name' key is reserved as '${K}'. Remove it.`;
};

export type ValidatedHttpConfig<T extends HttpErrorsConfig> = {
	// biome-ignore lint/suspicious/noExplicitAny: required for TypeScript's function type inference
	[K in keyof T & string]: T[K] extends [infer TStatus, (...args: infer A) => infer R]
		? [TStatus, (...args: A) => R & ValidateHttpErrorBody<K>]
		: T[K];
};

// =============================================================================
// Return types
// =============================================================================

/**
 * A factory function with a static `.status` property holding the literal
 * HTTP status code. The status is never included in the serialized error body.
 */
// biome-ignore lint/suspicious/noExplicitAny: required for TypeScript's function type inference
export type HttpErrorFactory<TName extends string, TStatus extends number, TFn extends (...args: any[]) => ErrorBody> =
	((...args: Parameters<TFn>) => Err<Readonly<{ name: TName } & ReturnType<TFn>>>) & {
		readonly status: TStatus;
	};

/** Return type of `defineHttpErrors`. Maps each config key to its `HttpErrorFactory`. */
export type DefineHttpErrorsReturn<TConfig extends HttpErrorsConfig> = {
	// biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
	[K in keyof TConfig & string]: TConfig[K] extends [infer TStatus extends number, infer TFn extends (...args: any[]) => ErrorBody]
		? HttpErrorFactory<K, TStatus, TFn>
		: never;
};

// =============================================================================
// Type utilities
// =============================================================================

/** Extract the error instance type from a single `HttpErrorFactory`. */
// biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
export type InferHttpError<T> = T extends (...args: any[]) => Err<infer R> ? R : never;

/** Extract the union of all error instance types from a `defineHttpErrors` return. */
export type InferHttpErrors<T> = {
	// biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
	[K in keyof T]: T[K] extends (...args: any[]) => Err<infer R> ? R : never;
}[keyof T];

// =============================================================================
// Implementation
// =============================================================================

/**
 * Defines a set of typed HTTP error factories, each paired with its HTTP
 * status code.
 *
 * Like `defineErrors`, each factory stamps `name` onto the error and wraps it
 * in `Err`. Unlike `defineErrors`, each factory function carries a static
 * `.status` property with the literal HTTP status code — the status is never
 * included in the serialized error body.
 *
 * @example
 * ```ts
 * const AssetError = defineHttpErrors({
 *   MissingFile:          [400, () => ({ message: 'Missing file' })],
 *   FileTooLarge:         [413, ({ size }: { size: number }) => ({ message: `File too large: ${size}`, size })],
 *   StorageLimitExceeded: [402, () => ({ message: 'Storage limit exceeded' })],
 * });
 *
 * type AssetError = InferHttpErrors<typeof AssetError>;
 *
 * // In a Hono route handler:
 * return c.json(AssetError.MissingFile(), AssetError.MissingFile.status);
 * // wire body: { error: { name: 'MissingFile', message: 'Missing file' }, data: null }
 * // http status: 400
 * ```
 */
export function defineHttpErrors<const TConfig extends HttpErrorsConfig>(
	config: TConfig & ValidatedHttpConfig<TConfig>,
): DefineHttpErrorsReturn<TConfig> {
	const result: Record<string, unknown> = {};

	for (const [name, [status, factory]] of Object.entries(config)) {
		const fn = (...args: unknown[]) => {
			const body = (factory as (...a: unknown[]) => Record<string, unknown>)(
				...args,
			);
			return Err(Object.freeze({ ...body, name }));
		};
		(fn as unknown as { status: number }).status = status;
		result[name] = fn;
	}

	return result as unknown as DefineHttpErrorsReturn<TConfig>;
}
