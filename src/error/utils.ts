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
 * Base type for any tagged error, used as a constraint for cause parameters.
 */
type AnyTaggedError = { name: string; message: string };

/**
 * Replaces the "Error" suffix with "Err" suffix in error type names.
 *
 * @template T - An error type name that must end with "Error"
 * @returns The type name with "Error" replaced by "Err"
 *
 * @example
 * ```ts
 * type NetworkErr = ReplaceErrorWithErr<"NetworkError">; // "NetworkErr"
 * type ValidationErr = ReplaceErrorWithErr<"ValidationError">; // "ValidationErr"
 * ```
 */
type ReplaceErrorWithErr<T extends `${string}Error`> =
	T extends `${infer TBase}Error` ? `${TBase}Err` : never;

// =============================================================================
// Factory Return Types
// =============================================================================

/**
 * Return type when neither context nor cause are constrained.
 * Both factory functions accept any context and cause at call time.
 */
type FlexibleFactories<TName extends `${string}Error`> = {
	[K in TName]: FlexibleErrorConstructor<K>;
} & {
	[K in ReplaceErrorWithErr<TName>]: FlexibleErrConstructor<TName>;
};

/**
 * Return type when context is fixed but cause is flexible.
 * Context shape is locked, but cause can be any TaggedError at call time.
 */
type ContextFixedFactories<
	TName extends `${string}Error`,
	TContext extends Record<string, unknown>,
> = {
	[K in TName]: ContextFixedErrorConstructor<K, TContext>;
} & {
	[K in ReplaceErrorWithErr<TName>]: ContextFixedErrConstructor<TName, TContext>;
};

/**
 * Return type when both context and cause are fixed.
 * Both shapes are locked at factory creation time.
 */
type BothFixedFactories<
	TName extends `${string}Error`,
	TContext extends Record<string, unknown>,
	TCause extends AnyTaggedError,
> = {
	[K in TName]: BothFixedErrorConstructor<K, TContext, TCause>;
} & {
	[K in ReplaceErrorWithErr<TName>]: BothFixedErrConstructor<
		TName,
		TContext,
		TCause
	>;
};

// =============================================================================
// Flexible Mode Constructor Types (using function overloads)
// =============================================================================

/**
 * Creates plain TaggedError objects with flexible context and cause.
 * Uses function overloads to precisely match return types to inputs.
 */
type FlexibleErrorConstructor<TName extends string> = {
	// Just message - no context or cause
	(input: { message: string }): TaggedError<TName, never, never>;
	// With context only
	<TContext extends Record<string, unknown>>(input: {
		message: string;
		context: TContext;
	}): TaggedError<TName, TContext, never>;
	// With cause only
	<TCause extends AnyTaggedError>(input: {
		message: string;
		cause: TCause;
	}): TaggedError<TName, never, TCause>;
	// With both context and cause
	<TContext extends Record<string, unknown>, TCause extends AnyTaggedError>(input: {
		message: string;
		context: TContext;
		cause: TCause;
	}): TaggedError<TName, TContext, TCause>;
};

/**
 * Creates Err-wrapped TaggedError objects with flexible context and cause.
 */
type FlexibleErrConstructor<TName extends string> = {
	(input: { message: string }): Err<TaggedError<TName, never, never>>;
	<TContext extends Record<string, unknown>>(input: {
		message: string;
		context: TContext;
	}): Err<TaggedError<TName, TContext, never>>;
	<TCause extends AnyTaggedError>(input: {
		message: string;
		cause: TCause;
	}): Err<TaggedError<TName, never, TCause>>;
	<TContext extends Record<string, unknown>, TCause extends AnyTaggedError>(input: {
		message: string;
		context: TContext;
		cause: TCause;
	}): Err<TaggedError<TName, TContext, TCause>>;
};

// =============================================================================
// Context-Fixed Mode Constructor Types
// =============================================================================

/**
 * Creates plain TaggedError objects with fixed context but flexible cause.
 * Context is always required. Cause is optional and inferred at call site.
 */
type ContextFixedErrorConstructor<
	TName extends string,
	TContext extends Record<string, unknown>,
> = {
	// Without cause
	(input: { message: string; context: TContext }): TaggedError<
		TName,
		TContext,
		never
	>;
	// With cause
	<TCause extends AnyTaggedError>(input: {
		message: string;
		context: TContext;
		cause: TCause;
	}): TaggedError<TName, TContext, TCause>;
};

/**
 * Creates Err-wrapped TaggedError objects with fixed context but flexible cause.
 */
type ContextFixedErrConstructor<
	TName extends string,
	TContext extends Record<string, unknown>,
> = {
	(input: { message: string; context: TContext }): Err<
		TaggedError<TName, TContext, never>
	>;
	<TCause extends AnyTaggedError>(input: {
		message: string;
		context: TContext;
		cause: TCause;
	}): Err<TaggedError<TName, TContext, TCause>>;
};

// =============================================================================
// Both-Fixed Mode Constructor Types
// =============================================================================

/**
 * Creates plain TaggedError objects with both context and cause fixed.
 * Context is required. Cause is optional but must match the specified type.
 */
type BothFixedErrorConstructor<
	TName extends string,
	TContext extends Record<string, unknown>,
	TCause extends AnyTaggedError,
> = {
	// Without cause
	(input: { message: string; context: TContext }): TaggedError<
		TName,
		TContext,
		never
	>;
	// With cause (must match TCause)
	(input: {
		message: string;
		context: TContext;
		cause: TCause;
	}): TaggedError<TName, TContext, TCause>;
};

/**
 * Creates Err-wrapped TaggedError objects with both context and cause fixed.
 */
type BothFixedErrConstructor<
	TName extends string,
	TContext extends Record<string, unknown>,
	TCause extends AnyTaggedError,
> = {
	(input: { message: string; context: TContext }): Err<
		TaggedError<TName, TContext, never>
	>;
	(input: {
		message: string;
		context: TContext;
		cause: TCause;
	}): Err<TaggedError<TName, TContext, TCause>>;
};

// =============================================================================
// Main Factory Function
// =============================================================================

/**
 * Creates two factory functions for building tagged errors with type-safe error chaining.
 *
 * Given an error name like "NetworkError", this returns:
 * - `NetworkError`: Creates a plain TaggedError object
 * - `NetworkErr`: Creates a TaggedError object wrapped in an Err result
 *
 * **Three usage modes:**
 *
 * 1. **Flexible mode** (no type params): Context and cause are optional, any shape accepted
 * 2. **Fixed context mode** (TContext specified): Context is required with that exact shape
 * 3. **Both fixed mode** (TContext + TCause): Context required, cause (if provided) must match
 *
 * @template TName - The name of the error type (must end with "Error")
 * @template TContext - Optional fixed context shape (makes context required)
 * @template TCause - Optional fixed cause type (constrains cause type if provided)
 * @param name - The name of the error type (must end with "Error")
 *
 * @example
 * ```ts
 * // Mode 1: Flexible - context optional, any shape
 * const { NetworkError, NetworkErr } = createTaggedError('NetworkError');
 * NetworkError({ message: 'Connection failed' });
 * NetworkError({ message: 'Timeout', context: { url: 'https://...' } });
 *
 * // Mode 2: Fixed context - context REQUIRED with exact shape
 * type BlobContext = { filename: string; code: 'INVALID' | 'TOO_LARGE' };
 * const { BlobError, BlobErr } = createTaggedError<'BlobError', BlobContext>('BlobError');
 * BlobError({ message: 'Invalid', context: { filename: 'x', code: 'INVALID' } });
 * // BlobError({ message: 'Error' }); // Type error - context required
 *
 * // Mode 3: Fixed context + cause - context required, cause constrained
 * const { ApiError, ApiErr } = createTaggedError<'ApiError', { endpoint: string }, NetworkError>('ApiError');
 * ApiError({ message: 'Failed', context: { endpoint: '/users' } });
 * ApiError({ message: 'Failed', context: { endpoint: '/users' }, cause: networkError });
 * ```
 */
// Overload 1: Flexible (no type constraints)
export function createTaggedError<TName extends `${string}Error`>(
	name: TName,
): FlexibleFactories<TName>;

// Overload 2: Context fixed, cause flexible
export function createTaggedError<
	TName extends `${string}Error`,
	TContext extends Record<string, unknown>,
>(name: TName): ContextFixedFactories<TName, TContext>;

// Overload 3: Both context and cause fixed
export function createTaggedError<
	TName extends `${string}Error`,
	TContext extends Record<string, unknown>,
	TCause extends AnyTaggedError,
>(name: TName): BothFixedFactories<TName, TContext, TCause>;

// Implementation
export function createTaggedError<
	TName extends `${string}Error`,
	TContext extends Record<string, unknown> = Record<string, unknown>,
	TCause extends AnyTaggedError = never,
>(name: TName): unknown {
	const errorConstructor = (input: {
		message: string;
		context?: TContext;
		cause?: TCause;
	}) => ({ name, ...input });

	const errName = name.replace(/Error$/, "Err") as ReplaceErrorWithErr<TName>;
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

