import { describe, it, expect, expectTypeOf } from "vitest";
import { defineError } from "./utils.js";
import type { TaggedError, AnyTaggedError } from "./types.js";

describe("defineError", () => {
	describe("basic usage (flexible mode)", () => {
		it("creates error factories without chaining", () => {
			const { NetworkError, NetworkErr } = defineError("NetworkError");

			const error = NetworkError({ message: "Connection failed" });

			expect(error.name).toBe("NetworkError");
			expect(error.message).toBe("Connection failed");
			expect(error.context).toBeUndefined();
			expect(error.cause).toBeUndefined();
		});

		it("allows optional context with any shape", () => {
			const { NetworkError } = defineError("NetworkError");

			const error = NetworkError({
				message: "Connection failed",
				context: { url: "https://example.com", timeout: 5000 },
			});

			expect(error.context).toEqual({
				url: "https://example.com",
				timeout: 5000,
			});
		});

		it("allows optional cause with any tagged error", () => {
			const { NetworkError } = defineError("NetworkError");
			const { ServiceError } = defineError("ServiceError");

			const networkError = NetworkError({ message: "Connection failed" });
			const serviceError = ServiceError({
				message: "Service unavailable",
				cause: networkError,
			});

			expect(serviceError.cause).toBe(networkError);
		});

		it("creates Err-wrapped factory", () => {
			const { NetworkErr } = defineError("NetworkError");

			const result = NetworkErr({ message: "Connection failed" });

			expect(result.error).toEqual({
				name: "NetworkError",
				message: "Connection failed",
			});
			expect(result.data).toBeNull();
		});
	});

	describe(".withContext<T>() - required context", () => {
		it("makes context required when T doesn't include undefined", () => {
			const { ApiError } = defineError("ApiError").withContext<{
				endpoint: string;
				status: number;
			}>();

			const error = ApiError({
				message: "Request failed",
				context: { endpoint: "/users", status: 500 },
			});

			expect(error.context).toEqual({ endpoint: "/users", status: 500 });
			expectTypeOf(error.context).toEqualTypeOf<{
				endpoint: string;
				status: number;
			}>();
		});

		it("type error when context is omitted (verified at compile time)", () => {
			const { ApiError } = defineError("ApiError").withContext<{
				endpoint: string;
			}>();

			// This would cause a type error if uncommented:
			// ApiError({ message: "Failed" }); // Error: context is required

			// Valid usage:
			const error = ApiError({
				message: "Failed",
				context: { endpoint: "/users" },
			});
			expect(error.context.endpoint).toBe("/users");
		});
	});

	describe(".withContext<T | undefined>() - optional typed context", () => {
		it("makes context optional when T includes undefined", () => {
			const { LogError } = defineError("LogError").withContext<
				{ file: string; line: number } | undefined
			>();

			// Without context
			const err1 = LogError({ message: "Parse failed" });
			expect(err1.context).toBeUndefined();

			// With context
			const err2 = LogError({
				message: "Parse failed",
				context: { file: "app.ts", line: 42 },
			});
			expect(err2.context).toEqual({ file: "app.ts", line: 42 });
		});

		it("context is typed when provided", () => {
			const { LogError } = defineError("LogError").withContext<
				{ file: string; line: number } | undefined
			>();

			const error = LogError({
				message: "Parse failed",
				context: { file: "app.ts", line: 42 },
			});

			// Type should include undefined since it's optional
			expectTypeOf(error.context).toEqualTypeOf<
				{ file: string; line: number } | undefined
			>();
		});
	});

	describe(".withCause<T>() - required cause", () => {
		it("makes cause required when T doesn't include undefined", () => {
			const { DbError } = defineError("DbError");
			type DbError = ReturnType<typeof DbError>;

			const { UnhandledError } =
				defineError("UnhandledError").withCause<AnyTaggedError>();

			const dbError = DbError({ message: "Connection failed" });
			const error = UnhandledError({
				message: "Unexpected error",
				cause: dbError,
			});

			expect(error.cause).toBe(dbError);
		});
	});

	describe(".withCause<T | undefined>() - optional typed cause", () => {
		it("makes cause optional when T includes undefined", () => {
			const { DbError } = defineError("DbError");
			type DbError = ReturnType<typeof DbError>;

			const { ServiceError } = defineError("ServiceError").withCause<
				DbError | undefined
			>();

			// Without cause
			const err1 = ServiceError({ message: "Failed" });
			expect(err1.cause).toBeUndefined();

			// With cause
			const dbError = DbError({ message: "Connection failed" });
			const err2 = ServiceError({ message: "Failed", cause: dbError });
			expect(err2.cause).toBe(dbError);
		});

		it("cause is typed when provided", () => {
			const { DbError } = defineError("DbError");
			type DbError = ReturnType<typeof DbError>;

			const { ServiceError } = defineError("ServiceError").withCause<
				DbError | undefined
			>();

			const dbError = DbError({ message: "Connection failed" });
			const error = ServiceError({ message: "Failed", cause: dbError });

			expectTypeOf(error.cause).toEqualTypeOf<DbError | undefined>();
		});
	});

	describe("chaining .withContext and .withCause", () => {
		it("supports chaining in any order", () => {
			const { DbError } = defineError("DbError");
			type DbError = ReturnType<typeof DbError>;

			// Context first, then cause
			const { UserError: UserError1 } = defineError("UserError")
				.withContext<{ userId: string }>()
				.withCause<DbError | undefined>();

			// Cause first, then context
			const { UserError: UserError2 } = defineError("UserError")
				.withCause<DbError | undefined>()
				.withContext<{ userId: string }>();

			const dbError = DbError({ message: "Query failed" });

			const err1 = UserError1({
				message: "User not found",
				context: { userId: "123" },
				cause: dbError,
			});

			const err2 = UserError2({
				message: "User not found",
				context: { userId: "123" },
				cause: dbError,
			});

			expect(err1.context).toEqual({ userId: "123" });
			expect(err1.cause).toBe(dbError);
			expect(err2.context).toEqual({ userId: "123" });
			expect(err2.cause).toBe(dbError);
		});

		it("full example with required context and optional cause", () => {
			const { DbError } = defineError("DbError");
			type DbError = ReturnType<typeof DbError>;

			const { CacheError } = defineError("CacheError");
			type CacheError = ReturnType<typeof CacheError>;

			const { RepoError, RepoErr } = defineError("RepoError")
				.withContext<{ entity: string; operation: string }>()
				.withCause<DbError | CacheError | undefined>();

			// Without cause
			const err1 = RepoError({
				message: "Entity not found",
				context: { entity: "User", operation: "findById" },
			});

			expect(err1.name).toBe("RepoError");
			expect(err1.context).toEqual({ entity: "User", operation: "findById" });
			expect(err1.cause).toBeUndefined();

			// With cause
			const dbError = DbError({ message: "Connection timeout" });
			const err2 = RepoError({
				message: "Failed to fetch user",
				context: { entity: "User", operation: "findById" },
				cause: dbError,
			});

			expect(err2.cause).toBe(dbError);

			// Err-wrapped version
			const result = RepoErr({
				message: "Entity not found",
				context: { entity: "User", operation: "findById" },
			});

			expect(result.error?.name).toBe("RepoError");
			expect(result.data).toBeNull();
		});
	});

	describe("type extraction with ReturnType", () => {
		it("ReturnType correctly infers error type", () => {
			const { FileError } = defineError("FileError").withContext<{
				path: string;
			}>();

			type FileError = ReturnType<typeof FileError>;

			const error: FileError = {
				name: "FileError",
				message: "Not found",
				context: { path: "/etc/config" },
			};

			expectTypeOf(error).toMatchTypeOf<
				TaggedError<"FileError", { path: string }, undefined>
			>();
		});
	});

	describe("builder methods return factories at every stage", () => {
		it("factories are available immediately after defineError", () => {
			const builder = defineError("NetworkError");

			// Can use factories directly
			const error = builder.NetworkError({ message: "Failed" });
			expect(error.name).toBe("NetworkError");

			// Can also chain
			const { NetworkError } = builder.withContext<{ url: string }>();
			const typedError = NetworkError({
				message: "Failed",
				context: { url: "https://example.com" },
			});
			expect(typedError.context.url).toBe("https://example.com");
		});

		it("factories are available after each chaining method", () => {
			const afterContext = defineError("ApiError").withContext<{
				endpoint: string;
			}>();

			// Can use factories here
			const err1 = afterContext.ApiError({
				message: "Failed",
				context: { endpoint: "/users" },
			});
			expect(err1.name).toBe("ApiError");

			// Can continue chaining
			const { DbError } = defineError("DbError");
			type DbError = ReturnType<typeof DbError>;

			const afterCause = afterContext.withCause<DbError | undefined>();
			const err2 = afterCause.ApiError({
				message: "Failed",
				context: { endpoint: "/users" },
			});
			expect(err2.name).toBe("ApiError");
		});
	});
});
