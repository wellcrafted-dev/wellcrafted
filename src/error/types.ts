import type { Err } from "../result/result.js";

/**
 * Base type for any tagged error, used as a minimum constraint.
 */
export type AnyTaggedError = { name: string; message: string };

// =============================================================================
// defineErrors type machinery
// =============================================================================

/**
 * Constructor return must include `message: string`.
 * JSON serializability is a convention, not enforced at the type level
 * (optional fields produce `T | undefined` which breaks `JsonObject`).
 */
export type ErrorBody = { message: string };

/**
 * Per-key validation: tells the user exactly what `name` will be stamped as.
 * If a user provides `name` in the return object, they see a descriptive error.
 */
type ValidateErrorBody<K extends string> = {
	message: string;
	name?: `The 'name' key is reserved as '${K}'. Remove it.`;
};

/** The config: each key is a variant name, each value is a constructor function. */
// biome-ignore lint/suspicious/noExplicitAny: required for TypeScript's function type inference
export type ErrorsConfig = Record<string, (...args: any[]) => ErrorBody>;

/** Validates each config entry, injecting the key-specific `name` reservation message. */
export type ValidatedConfig<T extends ErrorsConfig> = {
	// biome-ignore lint/suspicious/noExplicitAny: required for TypeScript's function type inference
	[K in keyof T & string]: T[K] extends (...args: infer A) => infer R
		? (...args: A) => R & ValidateErrorBody<K>
		: T[K];
};

/** Single factory: takes constructor args, returns Err-wrapped error. */
type ErrorFactory<
	TName extends string,
	// biome-ignore lint/suspicious/noExplicitAny: required for TypeScript's function type inference
	TFn extends (...args: any[]) => ErrorBody,
> = {
	[K in TName]: (
		...args: Parameters<TFn>
	) => Err<Readonly<{ name: TName } & ReturnType<TFn>>>;
};

// biome-ignore lint/suspicious/noExplicitAny: standard TypeScript pattern for UnionToIntersection
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

/** Return type of `defineErrors`. Maps each config key to its factory. */
export type DefineErrorsReturn<TConfig extends ErrorsConfig> =
	UnionToIntersection<
		{
			[K in keyof TConfig & string]: ErrorFactory<K, TConfig[K]>;
		}[keyof TConfig & string]
	>;

/** Extract the error type from a single factory. */
export type InferError<T> =
	// biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
	T extends (...args: any[]) => Err<infer R> ? R : never;

/** Extract union of ALL error types from a defineErrors return. */
export type InferErrors<T> = {
	// biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
	[K in keyof T]: T[K] extends (...args: any[]) => Err<infer R> ? R : never;
}[keyof T];
