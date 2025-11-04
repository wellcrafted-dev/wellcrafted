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
 * // Simple error without cause
 * type ValidationError = TaggedError<"ValidationError">;
 * const validationError: ValidationError = {
 *   name: "ValidationError",
 *   message: "Input is required"
 * };
 *
 * // Type-safe error chaining with specific cause types
 * type NetworkError = TaggedError<"NetworkError">;
 * type DatabaseError = TaggedError<"DatabaseError", NetworkError>;
 * type ServiceError = TaggedError<"ServiceError", DatabaseError>;
 * type APIError = TaggedError<"APIError", ServiceError>;
 *
 * const networkError: NetworkError = {
 *   name: "NetworkError",
 *   message: "Socket timeout after 5000ms",
 *   context: { host: "db.example.com", port: 5432, timeout: 5000 }
 * };
 *
 * const dbError: DatabaseError = {
 *   name: "DatabaseError",
 *   message: "Failed to connect to database",
 *   context: { operation: "connect", retries: 3 },
 *   cause: networkError // TypeScript enforces this must be NetworkError
 * };
 *
 * const serviceError: ServiceError = {
 *   name: "UserServiceError",
 *   message: "Could not fetch user profile",
 *   context: { userId: "123", method: "getUserById" },
 *   cause: dbError // TypeScript enforces this must be DatabaseError
 * };
 *
 * const apiError: APIError = {
 *   name: "APIError",
 *   message: "Internal server error",
 *   context: { endpoint: "/api/users/123", statusCode: 500 },
 *   cause: serviceError // TypeScript enforces this must be ServiceError
 * };
 *
 * // The entire error chain is JSON-serializable and type-safe
 * console.log(JSON.stringify(apiError, null, 2));
 * // Outputs:
 * // {
 * //   "name": "APIError",
 * //   "message": "Internal server error",
 * //   "context": { "endpoint": "/api/users/123", "statusCode": 500 },
 * //   "cause": {
 * //     "name": "UserServiceError",
 * //     "message": "Could not fetch user profile",
 * //     "context": { "userId": "123", "method": "getUserById" },
 * //     "cause": {
 * //       "name": "DatabaseError",
 * //       "message": "Failed to connect to database",
 * //       "context": { "operation": "connect", "retries": 3 },
 * //       "cause": {
 * //         "name": "NetworkError",
 * //         "message": "Socket timeout after 5000ms",
 * //         "context": { "host": "db.example.com", "port": 5432, "timeout": 5000 }
 * //       }
 * //     }
 * //   }
 * // }
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
export type TaggedError<
	TName extends string = string,
	TCause extends TaggedError<string, any> = TaggedError<string, any>,
> = Readonly<{
	name: TName;
	message: string;
	context?: Record<string, unknown>;
	cause?: TCause;
}>;
