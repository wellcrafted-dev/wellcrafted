/**
 * Base type for any tagged error, used as a constraint for cause parameters.
 */
export type AnyTaggedError = { name: string; message: string };

/**
 * Helper type that adds a context property.
 * - When TContext is undefined (default): context is OPTIONAL with loose typing
 * - When TContext is a specific type: context is REQUIRED with that exact type
 */
type WithContext<TContext> = TContext extends undefined
	? { context?: Record<string, unknown> }
	: { context: TContext };

/**
 * Helper type that adds a cause property.
 * - When TCause is undefined (default): cause is OPTIONAL, any tagged error allowed
 * - When TCause is a specific type: cause is OPTIONAL but constrained to that type
 *
 * Note: cause is always optional at runtime (errors can be created without causes),
 * but when TCause is specified, it constrains what cause types are allowed.
 */
type WithCause<TCause> = TCause extends undefined
	? { cause?: AnyTaggedError }
	: { cause?: TCause };

/**
 * Creates a tagged error type for type-safe error handling.
 * Uses the `name` property as a discriminator for tagged unions.
 *
 * The `cause` property enables error chaining, creating a JSON-serializable
 * call stack. Each error wraps its cause, building a complete trace of how
 * an error propagated through your application layers.
 *
 * **Type Parameter Behavior:**
 * - When `TContext` is `undefined` (default): `context` is OPTIONAL with type `Record<string, unknown>`
 * - When `TContext` is specified: `context` is REQUIRED with that exact type
 * - When `TCause` is `undefined` (default): `cause` is OPTIONAL, any `AnyTaggedError` allowed
 * - When `TCause` is specified: `cause` is OPTIONAL but constrained to that type
 *
 * @template TName - The error name (discriminator for tagged unions)
 * @template TContext - Additional context data for the error (default: undefined = optional loose context)
 * @template TCause - The type of error that caused this error (default: undefined = optional any cause)
 *
 * @example
 * ```ts
 * // Flexible error (context and cause optional, loosely typed)
 * type ValidationError = TaggedError<"ValidationError">;
 * const validationError: ValidationError = {
 *   name: "ValidationError",
 *   message: "Input is required"
 * };
 * // validationError.context is optional, typed as Record<string, unknown> | undefined
 *
 * // Error with required context (fixed context mode)
 * type NetworkError = TaggedError<"NetworkError", { host: string; port: number }>;
 * const networkError: NetworkError = {
 *   name: "NetworkError",
 *   message: "Socket timeout",
 *   context: { host: "db.example.com", port: 5432 } // Required!
 * };
 * const host = networkError.context.host; // Type-safe, no optional chaining needed
 *
 * // Error with fixed context and constrained cause type
 * type DatabaseError = TaggedError<"DatabaseError", { operation: string }, NetworkError>;
 * const dbError: DatabaseError = {
 *   name: "DatabaseError",
 *   message: "Failed to connect to database",
 *   context: { operation: "connect" }, // Required!
 *   cause: networkError // Optional, but must be NetworkError if provided
 * };
 *
 * // Discriminated unions still work
 * function handleError(error: ValidationError | NetworkError) {
 *   switch (error.name) {
 *     case "ValidationError": // TypeScript knows this is ValidationError
 *       break;
 *     case "NetworkError": // TypeScript knows this is NetworkError
 *       break;
 *   }
 * }
 * ```
 */
export type TaggedError<
	TName extends string = string,
	TContext extends Record<string, unknown> | undefined = undefined,
	TCause extends AnyTaggedError | undefined = undefined,
> = Readonly<
	{
		name: TName;
		message: string;
	} & WithContext<TContext> &
		WithCause<TCause>
>;
