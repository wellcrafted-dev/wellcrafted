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

/**
 * A tagged error type for type-safe error handling.
 * Uses the `name` property as a discriminator for tagged unions.
 * Additional fields are spread flat on the error object.
 *
 * @template TName - The error name (discriminator for tagged unions)
 * @template TFields - Additional fields spread flat on the error (default: none)
 */
export type TaggedError<
	TName extends string = string,
	TFields extends JsonObject = Record<never, never>,
> = Readonly<{ name: TName; message: string } & TFields>;
