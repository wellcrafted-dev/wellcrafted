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
 * @param name - The name of the error type (must end with "Error")
 * @returns An object with two factory functions:
 *   - [name]: Function that creates plain TaggedError objects
 *   - [name with "Error" replaced by "Err"]: Function that creates Err-wrapped TaggedError objects
 *
 * @example
 * ```ts
 * // Create error factories
 * const { NetworkError, NetworkErr } = createTaggedError('NetworkError');
 * const { DatabaseError, DatabaseErr } = createTaggedError('DatabaseError');
 *
 * // NetworkError: Creates just the error object
 * const error = NetworkError({
 *   message: 'Connection failed',
 *   context: { url: 'https://api.example.com' }
 * });
 * // Returns: { name: 'NetworkError', message: 'Connection failed', ... }
 *
 * // NetworkErr: Creates error and wraps in Err result
 * return NetworkErr({
 *   message: 'Connection failed',
 *   context: { url: 'https://api.example.com' }
 * });
 * // Returns: Err({ name: 'NetworkError', message: 'Connection failed', ... })
 *
 * // Type-safe error chaining with automatic type inference
 * const networkError = NetworkError({
 *   message: "Timeout",
 *   context: { host: "db.example.com", port: 5432 }
 * });
 *
 * const dbError = DatabaseError({
 *   message: 'Connection failed',
 *   cause: networkError // TypeScript infers the full networkError type automatically!
 * });
 * // dbError type: TaggedError<"DatabaseError", typeof networkError, { ... }>
 * // The cause type is fully inferred with all nested properties
 * ```
 */
export function createTaggedError<TErrorName extends `${string}Error`>(
	name: TErrorName,
): TaggedErrorFactories<TErrorName> {
	const errorConstructor = <
		// biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to match TaggedError definition
		TCause extends TaggedError<string, any, any> = never,
		TContext extends Record<string, unknown> = Record<string, unknown>,
	>(input: {
		message: string;
		context?: TContext;
		cause?: TCause;
	}): TaggedError<TErrorName, TCause, TContext> => ({ name, ...input });

	const errName = name.replace(
		/Error$/,
		"Err",
	) as ReplaceErrorWithErr<TErrorName>;
	const errConstructor = <
		// biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to match TaggedError definition
		TCause extends TaggedError<string, any, any> = never,
		TContext extends Record<string, unknown> = Record<string, unknown>,
	>(input: {
		message: string;
		context?: TContext;
		cause?: TCause;
	}) => Err(errorConstructor(input));

	return {
		[name]: errorConstructor,
		[errName]: errConstructor,
	} as TaggedErrorFactories<TErrorName>;
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
 * Return type for createTaggedError - combines both factory functions.
 *
 * Provides two factory functions:
 * - One that creates plain TaggedError objects (named with "Error" suffix)
 * - One that creates Err-wrapped TaggedError objects (named with "Err" suffix)
 *
 * @template TErrorName - The name of the error type (must end with "Error")
 */
type TaggedErrorFactories<TErrorName extends `${string}Error`> = {
	[K in TErrorName]: TaggedErrorConstructorFn<K>;
} & {
	[K in ReplaceErrorWithErr<TErrorName>]: TaggedErrConstructorFn<TErrorName>;
};

/**
 * Function signature that creates plain TaggedError objects.
 *
 * This represents a generic function where the caller can provide:
 * - `TCause`: The type of the error that caused this error (defaults to never for no cause)
 * - `TContext`: The type of additional context data (defaults to Record<string, unknown>)
 *
 * The function automatically infers these types from the input provided.
 *
 * @template TErrorName - The name of the error type
 */
type TaggedErrorConstructorFn<TErrorName extends string> = <
	// biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to match TaggedError definition
	TCause extends TaggedError<string, any, any> = never,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(input: {
	message: string;
	context?: TContext;
	cause?: TCause;
}) => TaggedError<TErrorName, TCause, TContext>;

/**
 * Function signature that creates Err-wrapped TaggedError objects.
 *
 * This represents a generic function where the caller can provide:
 * - `TCause`: The type of the error that caused this error (defaults to never for no cause)
 * - `TContext`: The type of additional context data (defaults to Record<string, unknown>)
 *
 * The function automatically infers these types from the input provided.
 *
 * @template TErrorName - The name of the error type
 */
type TaggedErrConstructorFn<TErrorName extends string> = <
	// biome-ignore lint/suspicious/noExplicitAny: Generic constraint requires any to match TaggedError definition
	TCause extends TaggedError<string, any, any> = never,
	TContext extends Record<string, unknown> = Record<string, unknown>,
>(input: {
	message: string;
	context?: TContext;
	cause?: TCause;
}) => Err<TaggedError<TErrorName, TCause, TContext>>;
