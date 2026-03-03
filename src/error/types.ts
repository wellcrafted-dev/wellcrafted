import type { Err } from "../result/result.js";

/**
 * JSON-serializable value types for error context.
 * Ensures all error data can be safely serialized via JSON.stringify.
 */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/**
 * JSON-serializable object type for error context.
 */
export type JsonObject = Record<string, JsonValue>;

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

/** The config: each key is an error name, each value is a constructor function. */
// biome-ignore lint/suspicious/noExplicitAny: required for TypeScript's function type inference
export type ErrorsConfig = Record<
	`${string}Error`,
	(...args: any[]) => ErrorBody
>;

/** Replaces the "Error" suffix with "Err" suffix. */
type ReplaceErrorWithErr<T extends `${string}Error`> =
	T extends `${infer TBase}Error` ? `${TBase}Err` : never;

/** Factory pair for a single error: plain factory + Err-wrapped factory. */
type FactoryPair<
	TName extends `${string}Error`,
	// biome-ignore lint/suspicious/noExplicitAny: required for TypeScript's function type inference
	TFn extends (...args: any[]) => ErrorBody,
> = {
	[K in TName]: (
		...args: Parameters<TFn>
	) => Readonly<{ name: TName } & ReturnType<TFn>>;
} & {
	[K in ReplaceErrorWithErr<TName>]: (
		...args: Parameters<TFn>
	) => Err<Readonly<{ name: TName } & ReturnType<TFn>>>;
};

// biome-ignore lint/suspicious/noExplicitAny: standard TypeScript pattern for UnionToIntersection
type UnionToIntersection<U> = (U extends any ? (k: U) => void : never) extends (
	k: infer I,
) => void
	? I
	: never;

/** Return type of `defineErrors`. Maps each config entry to its factory pair. */
export type DefineErrorsReturn<TConfig extends ErrorsConfig> =
	UnionToIntersection<
		{
			[K in keyof TConfig & `${string}Error`]: FactoryPair<
				K & `${string}Error`,
				TConfig[K]
			>;
		}[keyof TConfig & `${string}Error`]
	>;

/** Extract a single error type by name from a `defineErrors` return. */
export type InferError<T, K extends string> = K extends keyof T
	? // biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
		T[K] extends (...args: any[]) => infer R
		? R
		: never
	: never;

/** Extract union of ALL error types from a `defineErrors` return. */
export type InferErrorUnion<T> = {
	// biome-ignore lint/suspicious/noExplicitAny: required for conditional type inference
	[K in keyof T & `${string}Error`]: T[K] extends (...args: any[]) => infer R
		? R
		: never;
}[keyof T & `${string}Error`];
