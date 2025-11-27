/**
 * Helper type that adds a context property only when TContext is not never.
 * When TContext is never, returns an empty object (no context property).
 * When TContext is a real type, returns { context: TContext } (required property).
 */
type WithContext<TContext> = [TContext] extends [never]
	? // biome-ignore lint/complexity/noBannedTypes: Empty object type is intentional for conditional intersection
		{}
	: { context: TContext };

/**
 * Helper type that adds a cause property only when TCause is not never.
 * When TCause is never, returns an empty object (no cause property).
 * When TCause is a real type, returns { cause: TCause } (required property).
 */
// biome-ignore lint/complexity/noBannedTypes: Empty object type is intentional for conditional intersection
type WithCause<TCause> = [TCause] extends [never] ? {} : { cause: TCause };

/**
 * Creates a tagged error type for type-safe error handling.
 * Uses the `name` property as a discriminator for tagged unions.
 *
 * The `cause` property enables error chaining, creating a JSON-serializable
 * call stack. Each error wraps its cause, building a complete trace of how
 * an error propagated through your application layers.
 *
 * **Type Parameter Behavior:**
 * - When `TContext` is `never` (default): No `context` property exists
 * - When `TContext` is specified: `context` is a **required** property
 * - When `TCause` is `never` (default): No `cause` property exists
 * - When `TCause` is specified: `cause` is a **required** property
 *
 * @template TName - The error name (discriminator for tagged unions)
 * @template TCause - The type of error that caused this error (default: never = no cause property)
 * @template TContext - Additional context data for the error (default: never = no context property)
 *
 * @example
 * ```ts
 * // Simple error without context or cause (properties don't exist)
 * type ValidationError = TaggedError<"ValidationError">;
 * const validationError: ValidationError = {
 *   name: "ValidationError",
 *   message: "Input is required"
 * };
 * // validationError.context // Property 'context' does not exist
 *
 * // Error with required context
 * type NetworkError = TaggedError<"NetworkError", never, { host: string; port: number }>;
 * const networkError: NetworkError = {
 *   name: "NetworkError",
 *   message: "Socket timeout",
 *   context: { host: "db.example.com", port: 5432 } // Required!
 * };
 * const host = networkError.context.host; // No optional chaining needed
 *
 * // Type-safe error chaining with required cause
 * type DatabaseError = TaggedError<"DatabaseError", NetworkError, { operation: string }>;
 * const dbError: DatabaseError = {
 *   name: "DatabaseError",
 *   message: "Failed to connect to database",
 *   context: { operation: "connect" }, // Required!
 *   cause: networkError // Required!
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
	TCause = never,
	TContext = never,
> = Readonly<
	{
		name: TName;
		message: string;
	} & WithContext<TContext> &
		WithCause<TCause>
>;
