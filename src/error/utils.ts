import type { TaggedError } from "./types.js";
import { Err } from "../result/result.js";

/**
 * Extracts a readable error message from an unknown error value
 *
 * This utility is commonly used in mapErr functions when converting
 * unknown errors to typed error objects in the Result system.
 *
 * @param error - The unknown error to extract a message from
 * @returns A string representation of the error
 *
 * @example
 * ```ts
 * // With native Error
 * const error = new Error("Something went wrong");
 * const message = extractErrorMessage(error); // "Something went wrong"
 *
 * // With string error
 * const stringError = "String error";
 * const message2 = extractErrorMessage(stringError); // "String error"
 *
 * // With object error
 * const unknownError = { code: 500, details: "Server error" };
 * const message3 = extractErrorMessage(unknownError); // '{"code":500,"details":"Server error"}'
 *
 * // Used in mapErr function
 * const result = await tryAsync({
 *   try: () => riskyOperation(),
 *   mapErr: (error) => Err({
 *     name: "NetworkError",
 *     message: extractErrorMessage(error),
 *     context: { operation: "riskyOperation" },
 *     cause: error,
 *   }),
 * });
 * ```
 */
export function extractErrorMessage(error: unknown): string {
	// Handle Error instances
	if (error instanceof Error) {
		return error.message;
	}

	// Handle primitives
	if (typeof error === "string") return error;
	if (
		typeof error === "number" ||
		typeof error === "boolean" ||
		typeof error === "bigint"
	)
		return String(error);
	if (typeof error === "symbol") return error.toString();
	if (error === null) return "null";
	if (error === undefined) return "undefined";

	// Handle arrays
	if (Array.isArray(error)) return JSON.stringify(error);

	// Handle plain objects
	if (typeof error === "object") {
		const errorObj = error as Record<string, unknown>;

		// Check common error properties
		const messageProps = [
			"message",
			"error",
			"description",
			"title",
			"reason",
			"details",
		] as const;
		for (const prop of messageProps) {
			if (prop in errorObj && typeof errorObj[prop] === "string") {
				return errorObj[prop];
			}
		}

		// Fallback to JSON stringification
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}

	// Final fallback
	return String(error);
}

/**
 * Creates two factory functions for building tagged errors with type-safe error chaining.
 *
 * Given an error name like "NetworkError", this returns:
 * - `NetworkError`: Creates a plain TaggedError object
 * - `NetworkErr`: Creates a TaggedError object wrapped in an Err result
 *
 * The naming pattern automatically replaces the "Error" suffix with "Err" suffix
 * for the Result-wrapped version.
 *
 * @template TErrorName - The name of the error type (must end with "Error")
 * @template TContext - Optional fixed context shape for this error type (defaults to any object)
 * @template TCause - Optional fixed cause type for this error type (defaults to no cause)
 * @param name - The name of the error type (must end with "Error")
 * @returns An object with two factory functions:
 *   - [name]: Function that creates plain TaggedError objects
 *   - [name with "Error" replaced by "Err"]: Function that creates Err-wrapped TaggedError objects
 *
 * @example
 * ```ts
 * // Simple usage - flexible context
 * const { NetworkError, NetworkErr } = createTaggedError('NetworkError');
 * NetworkError({ message: 'Connection failed' });
 * NetworkError({ message: 'Connection failed', context: { url: 'https://api.example.com' } });
 *
 * // With fixed context shape - context is required and type-safe
 * const { DatabaseError, DatabaseErr } = createTaggedError<
 *   'DatabaseError',
 *   { host: string; port: number }
 * >('DatabaseError');
 *
 * DatabaseError({
 *   message: 'Connection failed',
 *   context: { host: 'localhost', port: 5432 }
 * });
 *
 * // With fixed context and cause type - both are hard-coded
 * const networkError = NetworkError({ message: 'Timeout' });
 * const { ApiError, ApiErr } = createTaggedError<
 *   'ApiError',
 *   { endpoint: string },
 *   typeof networkError
 * >('ApiError');
 *
 * ApiError({
 *   message: 'Request failed',
 *   context: { endpoint: '/users' },
 *   cause: networkError
 * });
 * ```
 */
// Overload 1: Fully flexible (no context or cause constraints)
export function createTaggedError<TErrorName extends `${string}Error`>(
	name: TErrorName,
): FlexibleTaggedErrorFactories<TErrorName>;

// Overload 2: Context fixed, cause flexible
export function createTaggedError<
	TErrorName extends `${string}Error`,
	TContext extends Record<string, unknown>,
>(
	name: TErrorName,
): ContextFixedTaggedErrorFactories<TErrorName, TContext>;

// Overload 3: Both context and cause fixed
export function createTaggedError<
	TErrorName extends `${string}Error`,
	TContext extends Record<string, unknown>,
	TCause extends TaggedError<string, any, any>,
>(
	name: TErrorName,
): BothFixedTaggedErrorFactories<TErrorName, TContext, TCause>;

// Implementation
export function createTaggedError<
	TErrorName extends `${string}Error`,
	TContext extends Record<string, unknown> = Record<string, unknown>,
	TCause extends TaggedError<string, any, any> = never,
>(
	name: TErrorName,
): any {
	const errorConstructor = (input: {
		message: string;
		context?: TContext;
		cause?: TCause;
	}): TaggedError<TErrorName, TCause, TContext> => ({ name, ...input });

	const errName = name.replace(
		/Error$/,
		"Err",
	) as ReplaceErrorWithErr<TErrorName>;
	const errConstructor = (input: {
		message: string;
		context?: TContext;
		cause?: TCause;
	}) => Err(errorConstructor(input));

	return {
		[name]: errorConstructor,
		[errName]: errConstructor,
	};
}

/**
 * Replaces the "Error" suffix with "Err" suffix in error type names.
 *
 * This utility type is used to create companion function names for error constructors
 * that return Err-wrapped results, maintaining consistent naming conventions.
 *
 * @template T - An error type name that must end with "Error"
 * @returns The type name with "Error" replaced by "Err"
 *
 * @example
 * ```ts
 * type NetworkErr = ReplaceErrorWithErr<"NetworkError">; // "NetworkErr"
 * type ValidationErr = ReplaceErrorWithErr<"ValidationError">; // "ValidationErr"
 * type AuthErr = ReplaceErrorWithErr<"AuthError">; // "AuthErr"
 * ```
 */
type ReplaceErrorWithErr<T extends `${string}Error`> =
	T extends `${infer TBase}Error` ? `${TBase}Err` : never;

/**
 * Return type when neither context nor cause are constrained.
 * Both factory functions accept any context and cause at call time.
 */
type FlexibleTaggedErrorFactories<TErrorName extends `${string}Error`> = {
	[K in TErrorName]: FlexibleTaggedErrorConstructorFn<K>;
} & {
	[K in ReplaceErrorWithErr<TErrorName>]: FlexibleTaggedErrConstructorFn<
		TErrorName
	>;
};

/**
 * Return type when context is fixed but cause is flexible.
 * Context shape is locked, but cause can be any TaggedError at call time.
 */
type ContextFixedTaggedErrorFactories<
	TErrorName extends `${string}Error`,
	TContext extends Record<string, unknown>,
> = {
	[K in TErrorName]: ContextFixedTaggedErrorConstructorFn<K, TContext>;
} & {
	[K in ReplaceErrorWithErr<TErrorName>]: ContextFixedTaggedErrConstructorFn<
		TErrorName,
		TContext
	>;
};

/**
 * Return type when both context and cause are fixed.
 * Both shapes are locked at factory creation time.
 */
type BothFixedTaggedErrorFactories<
	TErrorName extends `${string}Error`,
	TContext extends Record<string, unknown>,
	TCause extends TaggedError<string, any, any>,
> = {
	[K in TErrorName]: BothFixedTaggedErrorConstructorFn<
		K,
		TContext,
		TCause
	>;
} & {
	[K in ReplaceErrorWithErr<TErrorName>]: BothFixedTaggedErrConstructorFn<
		TErrorName,
		TContext,
		TCause
	>;
};

/**
 * Creates plain TaggedError objects with flexible context and cause.
 * Call-time generics allow any context and cause shape.
 */
type FlexibleTaggedErrorConstructorFn<TErrorName extends string> = <
	// biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to match TaggedError definition
	TCause extends TaggedError<string, any, any> = never,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(input: {
	message: string;
	context?: TContext;
	cause?: TCause;
}) => TaggedError<TErrorName, TCause, TContext>;

/**
 * Creates Err-wrapped TaggedError objects with flexible context and cause.
 * Call-time generics allow any context and cause shape.
 */
type FlexibleTaggedErrConstructorFn<TErrorName extends string> = <
	// biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to match TaggedError definition
	TCause extends TaggedError<string, any, any> = never,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(input: {
	message: string;
	context?: TContext;
	cause?: TCause;
}) => Err<TaggedError<TErrorName, TCause, TContext>>;

/**
 * Creates plain TaggedError objects with fixed context but flexible cause.
 * Context is required since the shape is locked at factory creation.
 * Cause can vary at call time.
 */
type ContextFixedTaggedErrorConstructorFn<
	TErrorName extends string,
	TContext extends Record<string, unknown>,
> = <
	// biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to match TaggedError definition
	TCause extends TaggedError<string, any, any> = never,
>(input: {
	message: string;
	context: TContext;
	cause?: TCause;
}) => TaggedError<TErrorName, TCause, TContext>;

/**
 * Creates Err-wrapped TaggedError objects with fixed context but flexible cause.
 * Context is required since the shape is locked at factory creation.
 * Cause can vary at call time.
 */
type ContextFixedTaggedErrConstructorFn<
	TErrorName extends string,
	TContext extends Record<string, unknown>,
> = <
	// biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to match TaggedError definition
	TCause extends TaggedError<string, any, any> = never,
>(input: {
	message: string;
	context: TContext;
	cause?: TCause;
}) => Err<TaggedError<TErrorName, TCause, TContext>>;

/**
 * Creates plain TaggedError objects with both context and cause fixed.
 * Both context and cause are required since their shapes are locked.
 */
type BothFixedTaggedErrorConstructorFn<
	TErrorName extends string,
	TContext extends Record<string, unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: TaggedError type requires any for flexible cause and context
	TCause extends TaggedError<string, any, any>,
> = (input: {
	message: string;
	context: TContext;
	cause: TCause;
}) => TaggedError<TErrorName, TCause, TContext>;

/**
 * Creates Err-wrapped TaggedError objects with both context and cause fixed.
 * Both context and cause are required since their shapes are locked.
 */
type BothFixedTaggedErrConstructorFn<
	TErrorName extends string,
	TContext extends Record<string, unknown>,
	// biome-ignore lint/suspicious/noExplicitAny: TaggedError type requires any for flexible cause and context
	TCause extends TaggedError<string, any, any>,
> = (input: {
	message: string;
	context: TContext;
	cause: TCause;
}) => Err<TaggedError<TErrorName, TCause, TContext>>;

