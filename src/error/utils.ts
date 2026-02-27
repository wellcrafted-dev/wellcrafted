import type { TaggedError, JsonObject } from "./types.js";
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
 * Constraint that prevents the reserved key `name` from appearing in fields.
 * `message` is not reserved — it's a built-in input handled separately from TFields.
 */
type NoReservedKeys = { name?: never };

/**
 * Replaces the "Error" suffix with "Err" suffix in error type names.
 */
type ReplaceErrorWithErr<T extends `${string}Error`> =
	T extends `${infer TBase}Error` ? `${TBase}Err` : never;

/**
 * Message template function type.
 * Receives the fields (without name/message) and returns a message string.
 */
type MessageFn<TFields extends JsonObject> = (input: TFields) => string;

// =============================================================================
// Factory Input Types
// =============================================================================

/** Factory input when message is required (no `.withMessage()`). */
type RequiredMessageInput<TFields extends JsonObject> = { message: string } &
	TFields;

/** Factory input when message is optional (`.withMessage()` provides default). */
type OptionalMessageInput<TFields extends JsonObject> = {
	message?: string;
} & TFields;

/**
 * Whether the entire input parameter can be omitted (called with no args).
 * True when TFields is empty or all-optional (and message is optional via withMessage).
 */
type IsInputOptional<TFields extends JsonObject> =
	Partial<TFields> extends TFields ? true : false;

// =============================================================================
// Builder & Factory Types
// =============================================================================

/**
 * Factories returned by `.withMessage()` — message is optional in the input.
 * Only has factory functions, no chain methods.
 */
type DefaultedFactories<
	TName extends `${string}Error`,
	TFields extends JsonObject,
> = {
	[K in TName]: IsInputOptional<TFields> extends true
		? (input?: OptionalMessageInput<TFields>) => TaggedError<TName, TFields>
		: (input: OptionalMessageInput<TFields>) => TaggedError<TName, TFields>;
} & {
	[K in ReplaceErrorWithErr<TName>]: IsInputOptional<TFields> extends true
		? (
				input?: OptionalMessageInput<TFields>,
			) => Err<TaggedError<TName, TFields>>
		: (
				input: OptionalMessageInput<TFields>,
			) => Err<TaggedError<TName, TFields>>;
};

/**
 * Builder object returned by createTaggedError (and .withFields()).
 * Has factory functions (message required) AND chain methods.
 */
type ErrorBuilder<
	TName extends `${string}Error`,
	TFields extends JsonObject = Record<never, never>,
> = {
	[K in TName]: (
		input: RequiredMessageInput<TFields>,
	) => TaggedError<TName, TFields>;
} & {
	[K in ReplaceErrorWithErr<TName>]: (
		input: RequiredMessageInput<TFields>,
	) => Err<TaggedError<TName, TFields>>;
} & {
	/** Defines additional fields spread flat on the error object. */
	withFields<T extends JsonObject & NoReservedKeys>(): ErrorBuilder<TName, T>;

	/**
	 * Provides a default message template. Returns factories where `message` is optional.
	 * Call-site `message` always overrides the template when both exist.
	 */
	withMessage(fn: MessageFn<TFields>): DefaultedFactories<TName, TFields>;
};

// =============================================================================
// Implementation
// =============================================================================

/**
 * Creates a new tagged error type with a fluent builder API.
 *
 * Returns an object with factory functions immediately available (message required),
 * plus `.withFields<T>()` and `.withMessage(fn)` for further configuration.
 *
 * @example No fields, message required at call site
 * ```ts
 * const { SimpleError, SimpleErr } = createTaggedError('SimpleError');
 * SimpleErr({ message: 'Something went wrong' });
 * ```
 *
 * @example No fields, with default message (message optional)
 * ```ts
 * const { RecorderBusyError } = createTaggedError('RecorderBusyError')
 *   .withMessage(() => 'A recording is already in progress');
 * RecorderBusyError();                                        // uses default
 * RecorderBusyError({ message: 'Custom message' });           // override
 * ```
 *
 * @example With fields, message required
 * ```ts
 * const { FsReadError } = createTaggedError('FsReadError')
 *   .withFields<{ path: string }>();
 * FsReadError({ message: 'Failed to read', path: '/etc/config' });
 * ```
 *
 * @example With fields + default message (message optional, overridable)
 * ```ts
 * const { ResponseError } = createTaggedError('ResponseError')
 *   .withFields<{ status: number }>()
 *   .withMessage(({ status }) => `HTTP ${status}`);
 * ResponseError({ status: 404 });                          // message: "HTTP 404"
 * ResponseError({ status: 404, message: 'Not found' });    // override
 * ```
 */
export function createTaggedError<TName extends `${string}Error`>(
	name: TName,
): ErrorBuilder<TName> {
	const errName = name.replace(
		/Error$/,
		"Err",
	) as ReplaceErrorWithErr<TName>;

	const createBuilder = <
		TFields extends JsonObject = Record<never, never>,
	>(): ErrorBuilder<TName, TFields> => {
		const errorConstructor = (
			input: { message: string } & TFields,
		) => {
			const { message, ...fields } = input;
			return {
				name,
				message,
				...fields,
			} as unknown as TaggedError<TName, TFields>;
		};

		const errConstructor = (
			input: { message: string } & TFields,
		) => Err(errorConstructor(input));

		return {
			[name]: errorConstructor,
			[errName]: errConstructor,

			withFields<T extends JsonObject & NoReservedKeys>() {
				return createBuilder<T>();
			},

			withMessage(
				fn: MessageFn<TFields>,
			): DefaultedFactories<TName, TFields> {
				const defaultedErrorConstructor = (
					input?: { message?: string } & TFields,
				) => {
					const {
						message: messageOverride,
						...fields
					} = (input ?? {}) as { message?: string } & TFields;
					const message = messageOverride ?? fn(fields as TFields);
					return {
						name,
						message,
						...fields,
					} as unknown as TaggedError<TName, TFields>;
				};

				const defaultedErrConstructor = (
					input?: { message?: string } & TFields,
				) => Err(defaultedErrorConstructor(input));

				return {
					[name]: defaultedErrorConstructor,
					[errName]: defaultedErrConstructor,
				} as DefaultedFactories<TName, TFields>;
			},
		} as ErrorBuilder<TName, TFields>;
	};

	return createBuilder();
}
