import { describe, it, expect, expectTypeOf } from "vitest";
import { createTaggedError } from "./utils.js";
import type { TaggedError, AnyTaggedError } from "./types.js";

// =============================================================================
// Basic Usage (Minimal Errors - No Context, No Cause)
// =============================================================================

describe("createTaggedError - basic usage (minimal errors)", () => {
	it("creates minimal error factories without chaining", () => {
		const { NetworkError, NetworkErr } = createTaggedError("NetworkError");

		const error = NetworkError({ message: "Connection failed" });

		expect(error.name).toBe("NetworkError");
		expect(error.message).toBe("Connection failed");
		// No context or cause properties exist on minimal errors
		expect("context" in error).toBe(false);
		expect("cause" in error).toBe(false);
	});

	it("creates Err-wrapped factory", () => {
		const { NetworkErr } = createTaggedError("NetworkError");

		const result = NetworkErr({ message: "Connection failed" });

		expect(result.error).toEqual({
			name: "NetworkError",
			message: "Connection failed",
		});
		expect(result.data).toBeNull();
	});

	it("minimal error type only has name and message", () => {
		const { NetworkError } = createTaggedError("NetworkError");

		const error = NetworkError({ message: "Error" });

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});
});

// =============================================================================
// .withContext<T>() - Required Context
// =============================================================================

describe("createTaggedError - .withContext<T>() - required context", () => {
	it("makes context required when T doesn't include undefined", () => {
		const { ApiError } = createTaggedError("ApiError").withContext<{
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
		const { ApiError } = createTaggedError("ApiError").withContext<{
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

// =============================================================================
// .withContext<T | undefined>() - Optional Typed Context
// =============================================================================

describe("createTaggedError - .withContext<T | undefined>() - optional typed context", () => {
	it("makes context optional when T includes undefined", () => {
		const { LogError } = createTaggedError("LogError").withContext<
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
		const { LogError } = createTaggedError("LogError").withContext<
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

// =============================================================================
// .withCause<T>() - Required Cause
// =============================================================================

describe("createTaggedError - .withCause<T>() - required cause", () => {
	it("makes cause required when T doesn't include undefined", () => {
		const { DbError } = createTaggedError("DbError");
		type DbError = ReturnType<typeof DbError>;

		const { UnhandledError } =
			createTaggedError("UnhandledError").withCause<AnyTaggedError>();

		const dbError = DbError({ message: "Connection failed" });
		const error = UnhandledError({
			message: "Unexpected error",
			cause: dbError,
		});

		expect(error.cause).toBe(dbError);
	});
});

// =============================================================================
// .withCause<T | undefined>() - Optional Typed Cause
// =============================================================================

describe("createTaggedError - .withCause<T | undefined>() - optional typed cause", () => {
	it("makes cause optional when T includes undefined", () => {
		const { DbError } = createTaggedError("DbError");
		type DbError = ReturnType<typeof DbError>;

		const { ServiceError } = createTaggedError("ServiceError").withCause<
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
		const { DbError } = createTaggedError("DbError");
		type DbError = ReturnType<typeof DbError>;

		const { ServiceError } = createTaggedError("ServiceError").withCause<
			DbError | undefined
		>();

		const dbError = DbError({ message: "Connection failed" });
		const error = ServiceError({ message: "Failed", cause: dbError });

		expectTypeOf(error.cause).toEqualTypeOf<DbError | undefined>();
	});
});

// =============================================================================
// Chaining .withContext and .withCause
// =============================================================================

describe("createTaggedError - chaining .withContext and .withCause", () => {
	it("supports chaining in any order", () => {
		const { DbError } = createTaggedError("DbError");
		type DbError = ReturnType<typeof DbError>;

		// Context first, then cause
		const { UserError: UserError1 } = createTaggedError("UserError")
			.withContext<{ userId: string }>()
			.withCause<DbError | undefined>();

		// Cause first, then context
		const { UserError: UserError2 } = createTaggedError("UserError")
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
		const { DbError } = createTaggedError("DbError");
		type DbError = ReturnType<typeof DbError>;

		const { CacheError } = createTaggedError("CacheError");
		type CacheError = ReturnType<typeof CacheError>;

		const { RepoError, RepoErr } = createTaggedError("RepoError")
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

// =============================================================================
// Type Extraction with ReturnType
// =============================================================================

describe("createTaggedError - type extraction with ReturnType", () => {
	it("ReturnType correctly infers error type", () => {
		const { FileError } = createTaggedError("FileError").withContext<{
			path: string;
		}>();

		type FileError = ReturnType<typeof FileError>;

		const error: FileError = {
			name: "FileError",
			message: "Not found",
			context: { path: "/etc/config" },
		};

		expectTypeOf(error).toExtend<
			TaggedError<"FileError", { path: string }, undefined>
		>();
	});
});

// =============================================================================
// Builder Methods Return Factories at Every Stage
// =============================================================================

describe("createTaggedError - builder methods return factories at every stage", () => {
	it("factories are available immediately after createTaggedError", () => {
		const builder = createTaggedError("NetworkError");

		// Can use factories directly (minimal error)
		const error = builder.NetworkError({ message: "Failed" });
		expect(error.name).toBe("NetworkError");

		// Can also chain to add context
		const { NetworkError } = builder.withContext<{ url: string }>();
		const typedError = NetworkError({
			message: "Failed",
			context: { url: "https://example.com" },
		});
		expect(typedError.context.url).toBe("https://example.com");
	});

	it("factories are available after each chaining method", () => {
		const afterContext = createTaggedError("ApiError").withContext<{
			endpoint: string;
		}>();

		// Can use factories here
		const err1 = afterContext.ApiError({
			message: "Failed",
			context: { endpoint: "/users" },
		});
		expect(err1.name).toBe("ApiError");

		// Can continue chaining
		const { DbError } = createTaggedError("DbError");
		type DbError = ReturnType<typeof DbError>;

		const afterCause = afterContext.withCause<DbError | undefined>();
		const err2 = afterCause.ApiError({
			message: "Failed",
			context: { endpoint: "/users" },
		});
		expect(err2.name).toBe("ApiError");
	});
});

// =============================================================================
// Error Chaining (with explicit .withContext and .withCause)
// =============================================================================

describe("createTaggedError - Error Chaining", () => {
	it("supports multi-level error chains with explicit types", () => {
		// Level 1: Database error with context
		const { DatabaseError } = createTaggedError("DatabaseError").withContext<{
			query: string;
			table: string;
		}>();
		type DatabaseError = ReturnType<typeof DatabaseError>;

		const dbError = DatabaseError({
			message: "Query failed",
			context: { query: "SELECT * FROM users", table: "users" },
		});

		// Level 2: Repository error wrapping database error
		const { RepositoryError } = createTaggedError("RepositoryError")
			.withContext<{ entity: string; operation: string }>()
			.withCause<DatabaseError | undefined>();
		type RepositoryError = ReturnType<typeof RepositoryError>;

		const repoError = RepositoryError({
			message: "Failed to fetch user",
			context: { entity: "User", operation: "findById" },
			cause: dbError,
		});

		// Level 3: Service error wrapping repository error
		const { ServiceError } = createTaggedError("ServiceError")
			.withContext<{ service: string; method: string }>()
			.withCause<RepositoryError | undefined>();

		const serviceError = ServiceError({
			message: "User service failed",
			context: { service: "UserService", method: "getProfile" },
			cause: repoError,
		});

		// Verify the chain
		expect(serviceError.name).toBe("ServiceError");
		expect(serviceError.cause?.name).toBe("RepositoryError");
		expect(serviceError.cause?.cause?.name).toBe("DatabaseError");
		expect(serviceError.cause?.cause?.context?.query).toBe(
			"SELECT * FROM users",
		);
	});

	it("errors are JSON serializable", () => {
		const { NetworkError } = createTaggedError("NetworkError").withContext<{
			host: string;
			port: number;
		}>();
		type NetworkError = ReturnType<typeof NetworkError>;

		const { ApiError } = createTaggedError("ApiError")
			.withContext<{ endpoint: string }>()
			.withCause<NetworkError | undefined>();

		const networkError = NetworkError({
			message: "Connection failed",
			context: { host: "example.com", port: 443 },
		});

		const apiError = ApiError({
			message: "Request failed",
			context: { endpoint: "/api/users" },
			cause: networkError,
		});

		const json = JSON.stringify(apiError);
		const parsed = JSON.parse(json);

		expect(parsed.name).toBe("ApiError");
		expect(parsed.message).toBe("Request failed");
		expect(parsed.context.endpoint).toBe("/api/users");
		expect(parsed.cause.name).toBe("NetworkError");
		expect(parsed.cause.context.host).toBe("example.com");
	});
});

// =============================================================================
// Type Safety
// =============================================================================

describe("createTaggedError - Type Safety", () => {
	it("minimal errors have correct types (no context, no cause)", () => {
		const { NetworkError } = createTaggedError("NetworkError");

		const error = NetworkError({ message: "Error" });

		// Minimal error only has name and message
		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});

	it("required context mode requires context", () => {
		type Ctx = { filename: string };
		const { FileError } = createTaggedError("FileError").withContext<Ctx>();

		const error = FileError({
			message: "Error",
			context: { filename: "test.txt" },
		});

		// Fixed context mode has precise typing
		expectTypeOf(error.context).toEqualTypeOf<{ filename: string }>();
	});

	it("chained context and cause constrains types", () => {
		// Define the cause type explicitly
		const { CauseError } = createTaggedError("CauseError");
		type CauseType = ReturnType<typeof CauseError>;

		const { WrapperError } = createTaggedError("WrapperError")
			.withContext<{ wrap: boolean }>()
			.withCause<CauseType | undefined>();

		const cause = CauseError({ message: "Root cause" });

		const wrapper = WrapperError({
			message: "Wrapped",
			context: { wrap: true },
			cause: cause,
		});

		// Cause is optional but constrained to CauseType when provided
		expectTypeOf(wrapper.cause).toEqualTypeOf<CauseType | undefined>();
	});

	it("ReturnType works correctly for minimal errors", () => {
		const { NetworkError } = createTaggedError("NetworkError");

		type NetworkErrorType = ReturnType<typeof NetworkError>;

		// Minimal error only has name and message
		expectTypeOf<NetworkErrorType>().toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});

	it("ReturnType works correctly with context", () => {
		type Ctx = { endpoint: string };
		const { ApiError } = createTaggedError("ApiError").withContext<Ctx>();

		type ApiErrorType = ReturnType<typeof ApiError>;

		// Context should be required and typed
		expectTypeOf<ApiErrorType>().toExtend<{
			name: "ApiError";
			message: string;
			context: { endpoint: string };
		}>();
	});

	it("TaggedError type with optional typed context", () => {
		// Direct use of TaggedError type with union
		type OptionalContextError = TaggedError<
			"OptionalError",
			{ code: string } | undefined
		>;

		// The context should be optional but typed
		const err1: OptionalContextError = {
			name: "OptionalError",
			message: "No context",
		};
		const err2: OptionalContextError = {
			name: "OptionalError",
			message: "With context",
			context: { code: "E001" },
		};

		expectTypeOf(err1.context).toEqualTypeOf<{ code: string } | undefined>();
		expect(err1.context).toBeUndefined();
		expect(err2.context?.code).toBe("E001");
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("createTaggedError - Edge Cases", () => {
	it("handles empty context object with explicit context type", () => {
		const { TestError } =
			createTaggedError("TestError").withContext<Record<string, unknown>>();
		const error = TestError({ message: "Error", context: {} });

		expect(error.context).toEqual({});
	});

	it("handles complex nested context", () => {
		type NestedContext = {
			nested: { deeply: { value: number } };
			array: number[];
			nullable: null;
		};
		const { TestError } =
			createTaggedError("TestError").withContext<NestedContext>();
		const error = TestError({
			message: "Error",
			context: {
				nested: { deeply: { value: 123 } },
				array: [1, 2, 3],
				nullable: null,
			},
		});

		expect(error.context.nested.deeply.value).toBe(123);
		expect(error.context.array).toEqual([1, 2, 3]);
		expect(error.context.nullable).toBeNull();
	});

	it("error objects are readonly", () => {
		const { TestError } = createTaggedError("TestError");
		const error = TestError({ message: "Original" });

		// TypeScript should prevent this, but verify at runtime the object shape
		expect(Object.isFrozen(error)).toBe(false); // Not frozen, but typed as Readonly
		expect(error.name).toBe("TestError");
	});
});

// =============================================================================
// Permissive Mode (Migration Path)
// =============================================================================

describe("createTaggedError - Permissive Mode (Migration Path)", () => {
	it("can opt into permissive context with Record<string, unknown> | undefined", () => {
		const { FlexibleError } = createTaggedError("FlexibleError").withContext<
			Record<string, unknown> | undefined
		>();

		// Without context
		const err1 = FlexibleError({ message: "Error" });
		expect(err1.context).toBeUndefined();

		// With any context shape
		const err2 = FlexibleError({
			message: "Error",
			context: { anything: "goes", nested: { data: 123 } },
		});
		expect(err2.context).toEqual({ anything: "goes", nested: { data: 123 } });
	});

	it("can opt into permissive cause with AnyTaggedError | undefined", () => {
		const { FlexibleError } = createTaggedError("FlexibleError").withCause<
			AnyTaggedError | undefined
		>();

		const { SomeError } = createTaggedError("SomeError");
		const { OtherError } = createTaggedError("OtherError");

		// Without cause
		const err1 = FlexibleError({ message: "Error" });
		expect(err1.cause).toBeUndefined();

		// With any tagged error as cause
		const err2 = FlexibleError({
			message: "Error",
			cause: SomeError({ message: "Some" }),
		});
		expect(err2.cause?.name).toBe("SomeError");

		const err3 = FlexibleError({
			message: "Error",
			cause: OtherError({ message: "Other" }),
		});
		expect(err3.cause?.name).toBe("OtherError");
	});

	it("fully permissive mode replicates old behavior", () => {
		const { LegacyError } = createTaggedError("LegacyError")
			.withContext<Record<string, unknown> | undefined>()
			.withCause<AnyTaggedError | undefined>();

		const { CauseError } = createTaggedError("CauseError");

		// Can use it just like old flexible mode
		const err1 = LegacyError({ message: "Error" });
		const err2 = LegacyError({
			message: "Error",
			context: { any: "data" },
		});
		const err3 = LegacyError({
			message: "Error",
			cause: CauseError({ message: "Cause" }),
		});
		const err4 = LegacyError({
			message: "Error",
			context: { any: "data" },
			cause: CauseError({ message: "Cause" }),
		});

		expect(err1.context).toBeUndefined();
		expect(err2.context).toEqual({ any: "data" });
		expect(err3.cause?.name).toBe("CauseError");
		expect(err4.context).toEqual({ any: "data" });
		expect(err4.cause?.name).toBe("CauseError");
	});

	it(".withContext() without generic defaults to optional permissive context", () => {
		// When called without a generic, defaults to Record<string, unknown> | undefined
		const { FlexError } = createTaggedError("FlexError").withContext();

		// Context is optional
		const err1 = FlexError({ message: "Error" });
		expect(err1.context).toBeUndefined();

		// Context accepts any shape
		const err2 = FlexError({
			message: "Error",
			context: { anything: "works", nested: { value: 123 } },
		});
		expect(err2.context).toEqual({ anything: "works", nested: { value: 123 } });
	});

	it(".withCause() without generic defaults to optional any tagged error", () => {
		// When called without a generic, defaults to AnyTaggedError | undefined
		const { FlexError } = createTaggedError("FlexError").withCause();

		const { SomeError } = createTaggedError("SomeError");
		const { OtherError } = createTaggedError("OtherError");

		// Cause is optional
		const err1 = FlexError({ message: "Error" });
		expect(err1.cause).toBeUndefined();

		// Cause accepts any tagged error
		const err2 = FlexError({
			message: "Error",
			cause: SomeError({ message: "Some" }),
		});
		expect(err2.cause?.name).toBe("SomeError");

		const err3 = FlexError({
			message: "Error",
			cause: OtherError({ message: "Other" }),
		});
		expect(err3.cause?.name).toBe("OtherError");
	});

	it(".withContext().withCause() without generics gives fully permissive error", () => {
		// Chaining both without generics gives the old permissive behavior
		const { FlexError } = createTaggedError("FlexError")
			.withContext()
			.withCause();

		const { CauseError } = createTaggedError("CauseError");

		// All combinations work
		const err1 = FlexError({ message: "Error" });
		const err2 = FlexError({ message: "Error", context: { any: "data" } });
		const err3 = FlexError({
			message: "Error",
			cause: CauseError({ message: "Cause" }),
		});
		const err4 = FlexError({
			message: "Error",
			context: { any: "data" },
			cause: CauseError({ message: "Cause" }),
		});

		expect(err1.context).toBeUndefined();
		expect(err1.cause).toBeUndefined();
		expect(err2.context).toEqual({ any: "data" });
		expect(err3.cause?.name).toBe("CauseError");
		expect(err4.context).toEqual({ any: "data" });
		expect(err4.cause?.name).toBe("CauseError");
	});
});
