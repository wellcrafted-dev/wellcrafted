import type {
	TaggedError,
	AnyTaggedError,
	JsonObject,
} from "./types.js";
import { Err } from "../result/result.js";

/**
 * Extracts a readable error message from an unknown error value
 *
 * @param error - The unknown error to extract a message from
 * @returns A string representation of the error
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
 */
type ReplaceErrorWithErr<T extends `${string}Error`> =
	T extends `${infer TBase}Error` ? `${TBase}Err` : never;

// =============================================================================
// Message Function Types
// =============================================================================

/**
 * Input provided to the message template function.
 * Contains everything the error will have except `message` (since that's what it computes).
 */
type MessageInput<
	TName extends string,
	TContext extends JsonObject | undefined,
	TCause extends AnyTaggedError | undefined,
> = { name: TName } & ([TContext] extends [undefined]
	? Record<never, never>
	: { context: Exclude<TContext, undefined> }) &
	([TCause] extends [undefined]
		? Record<never, never>
		: { cause: Exclude<TCause, undefined> });

/**
 * Message template function type.
 */
type MessageFn<
	TName extends string,
	TContext extends JsonObject | undefined,
	TCause extends AnyTaggedError | undefined,
> = (input: MessageInput<TName, TContext, TCause>) => string;

// =============================================================================
// Factory Input Types
// =============================================================================

/**
 * Helper type that determines optionality based on whether T includes undefined.
 */
type OptionalIfUndefined<T, TKey extends string> = undefined extends T
	? { [K in TKey]?: Exclude<T, undefined> }
	: { [K in TKey]: T };

/**
 * Input type for error factory functions.
 * Message is always computed from the template — no override escape hatch.
 * `context` and `cause` follow the same optionality rules as before.
 */
type ErrorCallInput<
	TContext extends JsonObject | undefined,
	TCause extends AnyTaggedError | undefined,
> = (TContext extends undefined
	? Record<never, never>
	: OptionalIfUndefined<TContext, "context">) &
	(TCause extends undefined
		? Record<never, never>
		: OptionalIfUndefined<TCause, "cause">);

// =============================================================================
// Builder & Factory Types
// =============================================================================

/**
 * Whether the factory input resolves to an empty object (no context, no cause).
 * When true, the input parameter becomes optional.
 */
type IsEmptyInput<
	TContext extends JsonObject | undefined,
	TCause extends AnyTaggedError | undefined,
> = ErrorCallInput<TContext, TCause> extends Record<never, never> ? true : false;

/**
 * The final factories object returned by `.withMessage()`.
 * Has factory functions, NO chain methods.
 * When ErrorCallInput resolves to Record<never, never>, input is optional.
 */
type FinalFactories<
	TName extends `${string}Error`,
	TContext extends JsonObject | undefined,
	TCause extends AnyTaggedError | undefined,
> = {
	[K in TName]: IsEmptyInput<TContext, TCause> extends true
		? (input?: ErrorCallInput<TContext, TCause>) => TaggedError<TName, TContext, TCause>
		: (input: ErrorCallInput<TContext, TCause>) => TaggedError<TName, TContext, TCause>;
} & {
	[K in ReplaceErrorWithErr<TName>]: IsEmptyInput<TContext, TCause> extends true
		? (input?: ErrorCallInput<TContext, TCause>) => Err<TaggedError<TName, TContext, TCause>>
		: (input: ErrorCallInput<TContext, TCause>) => Err<TaggedError<TName, TContext, TCause>>;
};

/**
 * Builder interface for the fluent createTaggedError API.
 * Has chain methods only, NO factory functions.
 * Must call `.withMessage(fn)` to get factories.
 */
type ErrorBuilder<
	TName extends `${string}Error`,
	TContext extends JsonObject | undefined = undefined,
	TCause extends AnyTaggedError | undefined = undefined,
> = {
	/**
	 * Constrains the context type for this error.
	 * `.withContext<T>()` where T doesn't include undefined → context is **required**
	 * `.withContext<T | undefined>()` → context is **optional** but typed when provided
	 */
	withContext<
		T extends JsonObject | undefined = JsonObject | undefined,
	>(): ErrorBuilder<TName, T, TCause>;

	/**
	 * Constrains the cause type for this error.
	 * `.withCause<T>()` where T doesn't include undefined → cause is **required**
	 * `.withCause<T | undefined>()` → cause is **optional** but typed when provided
	 */
	withCause<
		T extends AnyTaggedError | undefined = AnyTaggedError | undefined,
	>(): ErrorBuilder<TName, TContext, T>;

	/**
	 * Terminal method that defines how the error message is computed from its data.
	 * Returns the factory functions — this is the only way to get them.
	 *
	 * @param fn - Template function that receives `{ name, context?, cause? }` and returns a message string
	 */
	withMessage(
		fn: MessageFn<TName, TContext, TCause>,
	): FinalFactories<TName, TContext, TCause>;
};

// =============================================================================
// Implementation
// =============================================================================

/**
 * Creates a new tagged error type with a fluent builder API.
 *
 * The builder provides `.withContext<T>()`, `.withCause<T>()`, and `.withMessage(fn)`.
 * `.withMessage(fn)` is **required** and **terminal** — it returns the factory functions.
 *
 * @example Simple error
 * ```ts
 * const { RecorderBusyError, RecorderBusyErr } = createTaggedError('RecorderBusyError')
 *   .withMessage(() => 'A recording is already in progress');
 * ```
 *
 * @example Error with context
 * ```ts
 * const { DbNotFoundError, DbNotFoundErr } = createTaggedError('DbNotFoundError')
 *   .withContext<{ table: string; id: string }>()
 *   .withMessage(({ context }) => `${context.table} '${context.id}' not found`);
 * ```
 *
 * @example Error with context and cause
 * ```ts
 * const { ServiceError, ServiceErr } = createTaggedError('ServiceError')
 *   .withContext<{ operation: string }>()
 *   .withCause<DbServiceError>()
 *   .withMessage(({ context, cause }) =>
 *     `Operation '${context.operation}' failed: ${cause.message}`
 *   );
 * ```
 */
export function createTaggedError<TName extends `${string}Error`>(
	name: TName,
): ErrorBuilder<TName> {
	const createBuilder = <
		TContext extends JsonObject | undefined = undefined,
		TCause extends AnyTaggedError | undefined = undefined,
	>(): ErrorBuilder<TName, TContext, TCause> => {
		return {
			withContext<
				T extends JsonObject | undefined = JsonObject | undefined,
			>() {
				return createBuilder<T, TCause>();
			},
			withCause<
				T extends AnyTaggedError | undefined = AnyTaggedError | undefined,
			>() {
				return createBuilder<TContext, T>();
			},
			withMessage(
				fn: MessageFn<TName, TContext, TCause>,
			): FinalFactories<TName, TContext, TCause> {
				const errorConstructor = (
					input: ErrorCallInput<TContext, TCause> = {} as ErrorCallInput<TContext, TCause>,
				) => {
					const messageInput = {
						name,
						...("context" in input ? { context: input.context } : {}),
						...("cause" in input ? { cause: input.cause } : {}),
					} as MessageInput<TName, TContext, TCause>;

					return {
						name,
						message: fn(messageInput),
						...("context" in input ? { context: input.context } : {}),
						...("cause" in input ? { cause: input.cause } : {}),
					} as unknown as TaggedError<TName, TContext, TCause>;
				};

				const errName = name.replace(
					/Error$/,
					"Err",
				) as ReplaceErrorWithErr<TName>;
				const errConstructor = (
					input: ErrorCallInput<TContext, TCause> = {} as ErrorCallInput<TContext, TCause>,
				) => Err(errorConstructor(input));

				return {
					[name]: errorConstructor,
					[errName]: errConstructor,
				} as FinalFactories<TName, TContext, TCause>;
			},
		} as ErrorBuilder<TName, TContext, TCause>;
	};

	return createBuilder();
}
