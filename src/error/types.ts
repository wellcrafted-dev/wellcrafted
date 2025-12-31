/**
 * Base type for any tagged error, used as a constraint for cause parameters.
 */
export type AnyTaggedError = { name: string; message: string };

/**
 * Helper type that adds a context property.
 * - When TContext is undefined (default): NO context property (explicit opt-in)
 * - When TContext includes undefined (e.g., `{ foo: string } | undefined`): context is OPTIONAL but typed
 * - When TContext is a specific type without undefined: context is REQUIRED with that exact type
 *
 * This follows Rust's explicit error philosophy: context must be explicitly added via .withContext<T>().
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
 *
 * This follows Rust's explicit error philosophy: cause must be explicitly added via .withCause<T>().
 * Using brackets to prevent distributive conditional behavior with union types.
 */
type WithCause<TCause> = [TCause] extends [undefined]
	? Record<never, never>
	: [undefined] extends [TCause]
		? { cause?: Exclude<TCause, undefined> }
		: { cause: TCause };

/**
 * Creates a tagged error type for type-safe error handling.
 * Uses the `name` property as a discriminator for tagged unions.
 *
 * **Explicit Opt-In Philosophy (Rust-inspired):**
 * By default, errors only have `name` and `message`. Context and cause must be
 * explicitly added via type parameters. This follows Rust's thiserror pattern
 * where error properties are intentional architectural decisions.
 *
 * **Type Parameter Behavior:**
 * - When `TContext` is `undefined` (default): NO context property
 * - When `TContext` is `{ ... } | undefined`: `context` is OPTIONAL but typed
 * - When `TContext` is specified without undefined: `context` is REQUIRED
 * - When `TCause` is `undefined` (default): NO cause property
 * - When `TCause` is `{ ... } | undefined`: `cause` is OPTIONAL but typed
 * - When `TCause` is specified without undefined: `cause` is REQUIRED
 *
 * @template TName - The error name (discriminator for tagged unions)
 * @template TContext - Additional context data for the error (default: undefined = no context)
 * @template TCause - The type of error that caused this error (default: undefined = no cause)
 *
 * @example
 * ```ts
 * // Minimal error (no context, no cause)
 * type ValidationError = TaggedError<"ValidationError">;
 * const validationError: ValidationError = {
 *   name: "ValidationError",
 *   message: "Input is required"
 * };
 * // validationError only has name and message
 *
 * // Error with required context
 * type NetworkError = TaggedError<"NetworkError", { host: string; port: number }>;
 * const networkError: NetworkError = {
 *   name: "NetworkError",
 *   message: "Socket timeout",
 *   context: { host: "db.example.com", port: 5432 } // Required!
 * };
 *
 * // Error with OPTIONAL but TYPED context (union with undefined)
 * type LogError = TaggedError<"LogError", { file: string; line: number } | undefined>;
 * const logError1: LogError = { name: "LogError", message: "Parse failed" }; // OK
 * const logError2: LogError = { name: "LogError", message: "Parse failed", context: { file: "app.ts", line: 42 } }; // OK
 *
 * // Error with required context and optional cause
 * type DatabaseError = TaggedError<"DatabaseError", { operation: string }, NetworkError | undefined>;
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
