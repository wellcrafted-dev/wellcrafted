/**
 * Creates a tagged error type for type-safe error handling.
 * Uses the `name` property as a discriminator for tagged unions.
 *
 * The `cause` property enables error chaining, creating a JSON-serializable
 * call stack. Each error wraps its cause, building a complete trace of how
 * an error propagated through your application layers.
 *
 * Error types should follow the convention of ending with "Error" suffix.
 * The Err data structure wraps these error types in the Result system.
 *
 * @example
 * ```ts
 * // Error chaining creates a JSON-serializable call stack
 * const networkError = {
 *   name: "NetworkError",
 *   message: "Socket timeout after 5000ms",
 *   context: { host: "db.example.com", port: 5432, timeout: 5000 }
 * } satisfies TaggedError;
 *
 * const dbError = {
 *   name: "DatabaseError",
 *   message: "Failed to connect to database",
 *   context: { operation: "connect", retries: 3 },
 *   cause: networkError
 * } satisfies TaggedError;
 *
 * const serviceError = {
 *   name: "UserServiceError",
 *   message: "Could not fetch user profile",
 *   context: { userId: "123", method: "getUserById" },
 *   cause: dbError
 * } satisfies TaggedError;
 *
 * const apiError = {
 *   name: "APIError",
 *   message: "Internal server error",
 *   context: { endpoint: "/api/users/123", statusCode: 500 },
 *   cause: serviceError
 * } satisfies TaggedError;
 *
 * // The entire error chain is JSON-serializable
 * console.log(JSON.stringify(apiError, null, 2));
 * // Outputs a complete trace from API → Service → Database → Network
 *
 * // Specific tagged errors for discriminated unions
 * type ValidationError = TaggedError<"ValidationError">
 * type NetworkError = TaggedError<"NetworkError">
 *
 * function handleError(error: ValidationError | NetworkError) {
 *   switch (error.name) {
 *     case "ValidationError": // TypeScript knows this is ValidationError
 *       break;
 *     case "NetworkError": // TypeScript knows this is NetworkError
 *       break;
 *   }
 * }
 *
 * // Used in Result types:
 * function validate(input: string): Result<string, ValidationError> {
 *   if (!input) {
 *     return Err({
 *       name: "ValidationError",
 *       message: "Input is required",
 *       context: { input }
 *     });
 *   }
 *   return Ok(input);
 * }
 *
 * // Context is optional - omit when not needed:
 * function checkAuth(): Result<User, AuthError> {
 *   if (!isAuthenticated) {
 *     return Err({
 *       name: "AuthError",
 *       message: "User not authenticated"
 *     });
 *   }
 *   return Ok(currentUser);
 * }
 * ```
 */
export type TaggedError<T extends string = string> = Readonly<{
	name: T;
	message: string;
	context?: Record<string, unknown>;
	cause?: TaggedError;
}>;
