import type {
	TaggedError,
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
 * Constraint that prevents reserved keys (`name`, `message`) from appearing in fields.
 * Uses the `{ key?: never }` pattern — any type with `name` or `message` as a key
 * will fail to extend this constraint, producing a compile error.
 */
type NoReservedKeys = { name?: never; message?: never };

/**
 * Replaces the "Error" suffix with "Err" suffix in error type names.
 */
type ReplaceErrorWithErr<T extends `${string}Error`> =
	T extends `${infer TBase}Error` ? `${TBase}Err` : never;

// =============================================================================
// Message Function Types
// =============================================================================

/**
 * Message template function type.
 * Receives the fields (without name/message) and returns a message string.
 */
type MessageFn<TFields extends JsonObject> = (input: TFields) => string;

// =============================================================================
// Factory Input Types
// =============================================================================

/**
 * Whether TFields resolves to an empty object (no fields).
 * When true, the factory input parameter becomes optional.
 */
type IsEmptyFields<TFields extends JsonObject> =
	TFields extends Record<never, never> ? true : false;

/**
 * Whether all keys in TFields are optional.
 * When true, the factory input parameter becomes optional.
 */
type IsAllOptional<TFields extends JsonObject> =
	Partial<TFields> extends TFields ? true : false;

/**
 * Whether the factory input should be optional.
 * True when TFields is empty OR all fields are optional.
 */
type IsOptionalInput<TFields extends JsonObject> =
	IsEmptyFields<TFields> extends true
		? true
		: IsAllOptional<TFields> extends true
			? true
			: false;

// =============================================================================
// Builder & Factory Types
// =============================================================================

/**
 * The final factories object returned by `.withMessage()`.
 * Has factory functions, NO chain methods.
 */
type FinalFactories<
	TName extends `${string}Error`,
	TFields extends JsonObject,
> = {
	[K in TName]: IsOptionalInput<TFields> extends true
		? (input?: TFields) => TaggedError<TName, TFields>
		: (input: TFields) => TaggedError<TName, TFields>;
} & {
	[K in ReplaceErrorWithErr<TName>]: IsOptionalInput<TFields> extends true
		? (input?: TFields) => Err<TaggedError<TName, TFields>>
		: (input: TFields) => Err<TaggedError<TName, TFields>>;
};

/**
 * Builder interface for the fluent createTaggedError API.
 * Has chain methods only, NO factory functions.
 * Must call `.withMessage(fn)` to get factories.
 */
type ErrorBuilder<
	TName extends `${string}Error`,
	TFields extends JsonObject = Record<never, never>,
> = {
	/**
	 * Defines the additional fields for this error type.
	 * Fields are spread flat on the error object.
	 * Reserved keys (`name`, `message`) are rejected at compile time.
	 */
	withFields<T extends JsonObject & NoReservedKeys>(): ErrorBuilder<TName, T>;

	/**
	 * Terminal method that defines how the error message is computed from its fields.
	 * Returns the factory functions — this is the only way to get them.
	 *
	 * @param fn - Template function that receives the fields and returns a message string
	 */
	withMessage(
		fn: MessageFn<TFields>,
	): FinalFactories<TName, TFields>;
};

// =============================================================================
// Implementation
// =============================================================================

/**
 * Creates a new tagged error type with a fluent builder API.
 *
 * The builder provides `.withFields<T>()` and `.withMessage(fn)`.
 * `.withMessage(fn)` is **required** and **terminal** — it returns the factory functions.
 *
 * @example Tier 1: Static error (no fields)
 * ```ts
 * const { RecorderBusyError, RecorderBusyErr } = createTaggedError('RecorderBusyError')
 *   .withMessage(() => 'A recording is already in progress');
 * ```
 *
 * @example Tier 2: Reason-only error
 * ```ts
 * const { PlaySoundError, PlaySoundErr } = createTaggedError('PlaySoundError')
 *   .withFields<{ reason: string }>()
 *   .withMessage(({ reason }) => `Failed to play sound: ${reason}`);
 * ```
 *
 * @example Tier 3: Structured data error
 * ```ts
 * const { ResponseError, ResponseErr } = createTaggedError('ResponseError')
 *   .withFields<{ status: number; reason?: string }>()
 *   .withMessage(({ status, reason }) =>
 *     `HTTP ${status}${reason ? `: ${reason}` : ''}`
 *   );
 * ```
 */
export function createTaggedError<TName extends `${string}Error`>(
	name: TName,
): ErrorBuilder<TName> {
	const createBuilder = <
		TFields extends JsonObject = Record<never, never>,
	>(): ErrorBuilder<TName, TFields> => {
		return {
			withFields<T extends JsonObject & NoReservedKeys>() {
				return createBuilder<T>();
			},
			withMessage(
				fn: MessageFn<TFields>,
			): FinalFactories<TName, TFields> {
				const errorConstructor = (
					input?: TFields,
				) => {
					const fields = (input ?? {}) as TFields;
					return {
						name,
						message: fn(fields),
						...fields,
					} as unknown as TaggedError<TName, TFields>;
				};

				const errName = name.replace(
					/Error$/,
					"Err",
				) as ReplaceErrorWithErr<TName>;
				const errConstructor = (
					input?: TFields,
				) => Err(errorConstructor(input));

				return {
					[name]: errorConstructor,
					[errName]: errConstructor,
				} as FinalFactories<TName, TFields>;
			},
		} as ErrorBuilder<TName, TFields>;
	};

	return createBuilder();
}
