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
	if (typeof error === "number" || typeof error === "boolean" || typeof error === "bigint") return String(error);
	if (typeof error === "symbol") return error.toString();
	if (error === null) return "null";
	if (error === undefined) return "undefined";

	// Handle arrays
	if (Array.isArray(error)) return JSON.stringify(error);


	// Handle plain objects
	if (typeof error === "object") {
		const errorObj = error as Record<string, unknown>;

		// Check common error properties
		const messageProps = ["message", "error", "description", "title", "reason", "details"] as const;
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
 * Input type for creating a tagged error (everything except the name)
 */
type TaggedErrorWithoutName<
	TName extends string,
	TCause extends TaggedError<string, any> = TaggedError<string, any>
> = Omit<TaggedError<TName, TCause>, "name">;

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
 * Return type for createTaggedError - contains both factory functions.
 *
 * Provides two factory functions:
 * - One that creates plain TaggedError objects (named with "Error" suffix)
 * - One that creates Err-wrapped TaggedError objects (named with "Err" suffix)
 */
type TaggedErrorFactories<
	TErrorName extends `${string}Error`,
	TCause extends TaggedError<string, any> = TaggedError<string, any>
> = {
	[K in TErrorName]: (input: TaggedErrorWithoutName<K, TCause>) => TaggedError<K, TCause>;
} & {
		[K in ReplaceErrorWithErr<TErrorName>]: (
			input: TaggedErrorWithoutName<TErrorName, TCause>,
		) => Err<TaggedError<TErrorName, TCause>>;
	};

/**
 * Returns two different factory functions for tagged errors.
 *
 * Given an error name like "NetworkError", this returns:
 * - `NetworkError`: Creates a plain TaggedError object
 * - `NetworkErr`: Creates a TaggedError object wrapped in an Err result
 *
 * The naming pattern automatically replaces the "Error" suffix with "Err" suffix
 * for the Result-wrapped version.
 *
 * @param name - The name of the error type (must end with "Error")
 * @returns An object with two factory functions:
 *   - [name]: Function that creates plain TaggedError objects
 *   - [name with "Error" replaced by "Err"]: Function that creates Err-wrapped TaggedError objects
 *
 * @example
 * ```ts
 * // Simple error without typed cause
 * const { NetworkError, NetworkErr } = createTaggedError('NetworkError');
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
 * // Type-safe error chaining with specific cause types
 * type NetworkError = TaggedError<"NetworkError">;
 * const { DatabaseError, DatabaseErr } = createTaggedError<"DatabaseError", NetworkError>('DatabaseError');
 *
 * const networkError: NetworkError = { name: "NetworkError", message: "Timeout" };
 * const dbError = DatabaseError({
 *   message: 'Connection failed',
 *   cause: networkError // TypeScript enforces NetworkError type
 * });
 * ```
 */
export function createTaggedError<
	TErrorName extends `${string}Error`,
	TCause extends TaggedError<string, any> = TaggedError<string, any>
>(
	name: TErrorName,
): TaggedErrorFactories<TErrorName, TCause> {
	const errorConstructor = (
		error: TaggedErrorWithoutName<TErrorName, TCause>,
	): TaggedError<TErrorName, TCause> => ({ name, ...error });

	const errName = name.replace(
		/Error$/,
		"Err",
	) as ReplaceErrorWithErr<TErrorName>;
	const errConstructor = (error: TaggedErrorWithoutName<TErrorName, TCause>) =>
		Err(errorConstructor(error));

	return {
		[name]: errorConstructor,
		[errName]: errConstructor,
	} as TaggedErrorFactories<TErrorName, TCause>;
}
