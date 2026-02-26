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
 * Base type for any tagged error, used as a constraint for cause parameters.
 */
export type AnyTaggedError = { name: string; message: string };

/**
 * Helper type that adds a context property.
 * - When TContext is undefined (default): NO context property (explicit opt-in)
 * - When TContext includes undefined (e.g., `{ foo: string } | undefined`): context is OPTIONAL but typed
 * - When TContext is a specific type without undefined: context is REQUIRED with that exact type
 */
type WithContext<TContext> = [TContext] extends [undefined]
	? Record<never, never>
	: [undefined] extends [TContext]
		? { context?: Exclude<TContext, undefined> }
		: { context: TContext };

/**
 * Helper type that adds a cause property.
 * - When TCause is undefined (default): NO cause property (explicit opt-in)
 * - When TCause includes undefined (e.g., `NetworkError | undefined`): cause is OPTIONAL, constrained
 * - When TCause is a specific type without undefined: cause is REQUIRED
 */
type WithCause<TCause> = [TCause] extends [undefined]
	? Record<never, never>
	: [undefined] extends [TCause]
		? { cause?: Exclude<TCause, undefined> }
		: { cause: TCause };

/**
 * A tagged error type for type-safe error handling.
 * Uses the `name` property as a discriminator for tagged unions.
 *
 * @template TName - The error name (discriminator for tagged unions)
 * @template TContext - Additional context data for the error (default: undefined = no context)
 * @template TCause - The type of error that caused this error (default: undefined = no cause)
 */
export type TaggedError<
	TName extends string = string,
	TContext extends JsonObject | undefined = undefined,
	TCause extends AnyTaggedError | undefined = undefined,
> = Readonly<
	{
		name: TName;
		message: string;
	} & WithContext<TContext> &
		WithCause<TCause>
>;
