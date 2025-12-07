import type { TaggedError, AnyTaggedError } from "./types.js";
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
// Fluent API Types
// =============================================================================

/**
 * Helper type that determines optionality based on whether T includes undefined.
 * - If T includes undefined → property is optional
 * - If T does not include undefined → property is required
 */
type OptionalIfUndefined<T, TKey extends string> = undefined extends T
	? { [K in TKey]?: Exclude<T, undefined> }
	: { [K in TKey]: T };

/**
 * Input type for error constructors with fluent API context/cause handling.
 */
type ErrorInput<
	TContext extends Record<string, unknown> | undefined,
	TCause extends AnyTaggedError | undefined,
> = { message: string } & (TContext extends undefined
	? { context?: Record<string, unknown> }
	: OptionalIfUndefined<TContext, "context">) &
	(TCause extends undefined
		? { cause?: AnyTaggedError }
		: OptionalIfUndefined<TCause, "cause">);

/**
 * The factories object returned by createTaggedError and its builder methods.
 */
type ErrorFactories<
	TName extends `${string}Error`,
	TContext extends Record<string, unknown> | undefined,
	TCause extends AnyTaggedError | undefined,
> = {
	[K in TName]: (
		input: ErrorInput<TContext, TCause>,
	) => TaggedError<TName, TContext, TCause>;
} & {
	[K in ReplaceErrorWithErr<TName>]: (
		input: ErrorInput<TContext, TCause>,
	) => Err<TaggedError<TName, TContext, TCause>>;
};

/**
 * Builder interface for the fluent createTaggedError API.
 * Provides chaining methods and the error factories.
 */
type ErrorBuilder<
	TName extends `${string}Error`,
	TContext extends Record<string, unknown> | undefined = undefined,
	TCause extends AnyTaggedError | undefined = undefined,
> = ErrorFactories<TName, TContext, TCause> & {
	/**
	 * Constrains the context type for this error.
	 *
	 * Optionality is determined by whether the type includes `undefined`:
	 * - `withContext<T>()` where T doesn't include undefined → context is **required**
	 * - `withContext<T | undefined>()` → context is **optional** but typed when provided
	 *
	 * @typeParam T - The shape of the context object. Include `| undefined` to make optional.
	 *
	 * @example Required context
	 * ```ts
	 * const { FileError } = createTaggedError('FileError')
	 *   .withContext<{ path: string }>()
	 *
	 * FileError({ message: 'Not found', context: { path: '/etc/config' } })  // OK
	 * FileError({ message: 'Not found' })  // Type error: context required
	 * ```
	 *
	 * @example Optional but typed context
	 * ```ts
	 * const { LogError } = createTaggedError('LogError')
	 *   .withContext<{ file: string; line: number } | undefined>()
	 *
	 * LogError({ message: 'Parse error' })  // OK
	 * LogError({ message: 'Parse error', context: { file: 'app.ts', line: 42 } })  // OK
	 * ```
	 */
	withContext<T extends Record<string, unknown> | undefined>(): ErrorBuilder<
		TName,
		T,
		TCause
	>;

	/**
	 * Constrains the cause type for this error.
	 *
	 * Optionality is determined by whether the type includes `undefined`:
	 * - `withCause<T>()` where T doesn't include undefined → cause is **required**
	 * - `withCause<T | undefined>()` → cause is **optional** but typed when provided
	 *
	 * Since cause is typically optional, include `| undefined` in most cases.
	 *
	 * @typeParam T - The allowed cause type(s). Include `| undefined` to make optional.
	 *
	 * @example Optional typed cause (common)
	 * ```ts
	 * const { ServiceError } = createTaggedError('ServiceError')
	 *   .withCause<DbError | CacheError | undefined>()
	 *
	 * ServiceError({ message: 'Failed' })  // OK
	 * ServiceError({ message: 'Failed', cause: dbError })  // OK
	 * ```
	 *
	 * @example Required cause (for wrapper errors)
	 * ```ts
	 * const { UnhandledError } = createTaggedError('UnhandledError')
	 *   .withCause<AnyTaggedError>()
	 *
	 * UnhandledError({ message: 'Unexpected', cause: originalError })  // OK
	 * UnhandledError({ message: 'Unexpected' })  // Type error: cause required
	 * ```
	 */
	withCause<T extends AnyTaggedError | undefined>(): ErrorBuilder<
		TName,
		TContext,
		T
	>;
};

// =============================================================================
// Fluent API Implementation
// =============================================================================

/**
 * Creates a new tagged error type with a fluent builder API.
 *
 * Returns an object containing:
 * - `{Name}Error`: Factory function that creates plain TaggedError objects
 * - `{Name}Err`: Factory function that creates Err-wrapped TaggedError objects
 * - `withContext<T>()`: Chain method to constrain context type
 * - `withCause<T>()`: Chain method to constrain cause type
 *
 * **Default behavior (no chaining):**
 * - `context` is optional and accepts any `Record<string, unknown>`
 * - `cause` is optional and accepts any `AnyTaggedError`
 *
 * **Optionality via type unions:**
 * Both `withContext` and `withCause` determine optionality based on whether
 * the type includes `undefined`:
 * - `T` without undefined → property is required
 * - `T | undefined` → property is optional but typed when provided
 *
 * @template TName - The name of the error type (must end with "Error")
 * @param name - The name of the error type
 *
 * @example Simple error (flexible mode)
 * ```ts
 * const { NetworkError, NetworkErr } = createTaggedError('NetworkError')
 *
 * NetworkError({ message: 'Connection failed' })
 * NetworkError({ message: 'Timeout', context: { url: 'https://...' } })
 * ```
 *
 * @example Required context
 * ```ts
 * const { ApiError, ApiErr } = createTaggedError('ApiError')
 *   .withContext<{ endpoint: string; status: number }>()
 *
 * ApiError({ message: 'Failed', context: { endpoint: '/users', status: 500 } })
 * // ApiError({ message: 'Failed' })  // Type error: context required
 * ```
 *
 * @example Optional typed cause
 * ```ts
 * const { ServiceError } = createTaggedError('ServiceError')
 *   .withCause<DbError | CacheError | undefined>()
 *
 * ServiceError({ message: 'Failed' })  // OK
 * ServiceError({ message: 'Failed', cause: dbError })  // OK, typed
 * ```
 *
 * @example Full example with both
 * ```ts
 * const { UserServiceError } = createTaggedError('UserServiceError')
 *   .withContext<{ userId: string }>()
 *   .withCause<RepoError | undefined>()
 *
 * // Type extraction works
 * type UserServiceError = ReturnType<typeof UserServiceError>
 * ```
 */
export function createTaggedError<TName extends `${string}Error`>(
	name: TName,
): ErrorBuilder<TName> {
	const createBuilder = <
		TContext extends Record<string, unknown> | undefined = undefined,
		TCause extends AnyTaggedError | undefined = undefined,
	>(): ErrorBuilder<TName, TContext, TCause> => {
		const errorConstructor = (input: ErrorInput<TContext, TCause>) =>
			({ name, ...input }) as unknown as TaggedError<TName, TContext, TCause>;

		const errName = name.replace(
			/Error$/,
			"Err",
		) as ReplaceErrorWithErr<TName>;
		const errConstructor = (input: ErrorInput<TContext, TCause>) =>
			Err(errorConstructor(input));

		return {
			[name]: errorConstructor,
			[errName]: errConstructor,
			withContext<T extends Record<string, unknown> | undefined>() {
				return createBuilder<T, TCause>();
			},
			withCause<T extends AnyTaggedError | undefined>() {
				return createBuilder<TContext, T>();
			},
		} as ErrorBuilder<TName, TContext, TCause>;
	};

	return createBuilder();
}
