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
 * `message` is not reserved — when `.withMessage()` seals it, `message` is
 * simply absent from the input type. When `.withMessage()` is not used,
 * `message` is a built-in input handled separately from TFields.
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

/**
 * Whether the entire input parameter can be omitted (called with no args).
 * True when TFields is empty or all-optional (and message is sealed via withMessage).
 */
type IsInputOptional<TFields extends JsonObject> =
	Partial<TFields> extends TFields ? true : false;

// =============================================================================
// Builder & Factory Types
// =============================================================================

/**
 * Factories returned by `.withMessage()` — message is sealed by the template.
 * `message` is NOT in the input type. Only has factory functions, no chain methods.
 */
type SealedFactories<
	TName extends `${string}Error`,
	TFields extends JsonObject,
> = {
	[K in TName]: IsInputOptional<TFields> extends true
		? (input?: TFields) => TaggedError<TName, TFields>
		: (input: TFields) => TaggedError<TName, TFields>;
} & {
	[K in ReplaceErrorWithErr<TName>]: IsInputOptional<TFields> extends true
		? (input?: TFields) => Err<TaggedError<TName, TFields>>
		: (input: TFields) => Err<TaggedError<TName, TFields>>;
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
	 * Seals the message — the template owns it entirely.
	 * `message` is NOT in the returned factory's input type.
	 */
	withMessage(fn: MessageFn<TFields>): SealedFactories<TName, TFields>;
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
 * Two mutually exclusive modes:
 * 1. **No `.withMessage()`**: `message` is required at the call site
 * 2. **With `.withMessage()`**: message is sealed — NOT in the input type
 *
 * @example No fields, message required at call site
 * ```ts
 * const { SimpleError, SimpleErr } = createTaggedError('SimpleError');
 * SimpleErr({ message: 'Something went wrong' });
 * ```
 *
 * @example No fields, with sealed message
 * ```ts
 * const { RecorderBusyError } = createTaggedError('RecorderBusyError')
 *   .withMessage(() => 'A recording is already in progress');
 * RecorderBusyError();  // message always: 'A recording is already in progress'
 * ```
 *
 * @example With fields, message required
 * ```ts
 * const { FsReadError } = createTaggedError('FsReadError')
 *   .withFields<{ path: string }>();
 * FsReadError({ message: 'Failed to read', path: '/etc/config' });
 * ```
 *
 * @example With fields + sealed message (template computes from fields)
 * ```ts
 * const { ResponseError } = createTaggedError('ResponseError')
 *   .withFields<{ status: number }>()
 *   .withMessage(({ status }) => `HTTP ${status}`);
 * ResponseError({ status: 404 });  // message: "HTTP 404"
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
			): SealedFactories<TName, TFields> {
				const sealedErrorConstructor = (input?: TFields) => {
					const fields = (input ?? {}) as TFields;
					const message = fn(fields);
					return {
						name,
						message,
						...fields,
					} as unknown as TaggedError<TName, TFields>;
				};

				const sealedErrConstructor = (input?: TFields) =>
					Err(sealedErrorConstructor(input));

				return {
					[name]: sealedErrorConstructor,
					[errName]: sealedErrConstructor,
				} as SealedFactories<TName, TFields>;
			},
		} as ErrorBuilder<TName, TFields>;
	};

	return createBuilder();
}
