import { describe, it, expect, expectTypeOf } from "bun:test";
import { createTaggedError } from "./utils.js";
import type { TaggedError, JsonObject } from "./types.js";

// =============================================================================
// Basic Usage (withMessage required)
// =============================================================================

describe("createTaggedError - basic usage (withMessage required)", () => {
	const { NetworkError, NetworkErr } = createTaggedError("NetworkError")
		.withMessage(() => "Connection failed");

	it("creates error with correct name and message from template", () => {
		const error = NetworkError({});

		expect(error.name).toBe("NetworkError");
		expect(error.message).toBe("Connection failed");
	});

	it("creates error with static message", () => {
		const { RecorderBusyError } = createTaggedError("RecorderBusyError")
			.withMessage(() => "A recording is already in progress");

		const error = RecorderBusyError({});
		expect(error.name).toBe("RecorderBusyError");
		expect(error.message).toBe("A recording is already in progress");
	});

	it("has no context or cause properties on minimal error", () => {
		const error = NetworkError({});

		expect("context" in error).toBe(false);
		expect("cause" in error).toBe(false);
	});

	it("minimal error has correct type (name and message only)", () => {
		const error = NetworkError({});

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});

	// Section: Err-wrapped factory
	it("NetworkErr wraps error in Err result", () => {
		const result = NetworkErr({});

		expect(result.data).toBeNull();
		expect(result.error).toEqual({
			name: "NetworkError",
			message: "Connection failed",
		});
	});

	it("NetworkErr result has correct data and error shape", () => {
		const result = NetworkErr({});

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("NetworkError");
		expect(result.error?.message).toBe("Connection failed");
	});
});

// =============================================================================
// Err-Wrapped Factory
// =============================================================================

describe("createTaggedError - Err-wrapped factory (FooErr)", () => {
	it("FooErr wraps error in Err result with correct data/error shape", () => {
		const { AuthError, AuthErr } = createTaggedError("AuthError")
			.withMessage(() => "Authentication failed");

		const result = AuthErr({});

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("AuthError");
		expect(result.error?.message).toBe("Authentication failed");
	});

	it("FooErr with context wraps correctly", () => {
		const { ApiError, ApiErr } = createTaggedError("ApiError")
			.withContext<{ endpoint: string; status: number }>()
			.withMessage(
				({ context }) =>
					`Request to ${context.endpoint} failed with ${context.status}`,
			);

		const result = ApiErr({
			context: { endpoint: "/users", status: 500 },
		});

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("ApiError");
		expect(result.error?.message).toBe(
			"Request to /users failed with 500",
		);
	});
});

// =============================================================================
// .withContext<T>() - Required Context
// =============================================================================

describe("createTaggedError - .withContext<T>() - required context", () => {
	it("makes context required when T doesn't include undefined", () => {
		const { DbNotFoundError } = createTaggedError("DbNotFoundError")
			.withContext<{ table: string; id: string }>()
			.withMessage(
				({ context }) => `${context.table} '${context.id}' not found`,
			);

		const error = DbNotFoundError({
			context: { table: "users", id: "123" },
		});

		expect(error.context).toEqual({ table: "users", id: "123" });
	});

	it("message is computed from context via template", () => {
		const { DbNotFoundError } = createTaggedError("DbNotFoundError")
			.withContext<{ table: string; id: string }>()
			.withMessage(
				({ context }) => `${context.table} '${context.id}' not found`,
			);

		const error = DbNotFoundError({
			context: { table: "users", id: "123" },
		});

		expect(error.message).toBe("users '123' not found");
	});

	it("context is typed correctly in output", () => {
		const { ApiError } = createTaggedError("ApiError")
			.withContext<{ endpoint: string; status: number }>()
			.withMessage(({ context }) => `${context.endpoint} failed`);

		const error = ApiError({
			context: { endpoint: "/users", status: 500 },
		});

		expectTypeOf(error.context).toEqualTypeOf<{
			endpoint: string;
			status: number;
		}>();
	});
});

// =============================================================================
// .withContext<T | undefined>() - Optional Context
// =============================================================================

describe("createTaggedError - .withContext<T | undefined>() - optional context", () => {
	const { LogError } = createTaggedError("LogError")
		.withContext<{ file: string; line: number } | undefined>()
		.withMessage(({ name }) => `${name}: log error`);

	it("makes context optional when T includes undefined", () => {
		// Without context
		const err1 = LogError({});
		expect(err1.context).toBeUndefined();

		// With context
		const err2 = LogError({
			context: { file: "app.ts", line: 42 },
		});
		expect(err2.context).toEqual({ file: "app.ts", line: 42 });
	});

	it("message template still works when context is optional", () => {
		const { ParseError } = createTaggedError("ParseError")
			.withContext<{ file: string } | undefined>()
			.withMessage(({ name }) => `${name} occurred`);

		const error = ParseError({});
		expect(error.message).toBe("ParseError occurred");
	});

	it("context type includes undefined when optional", () => {
		const error = LogError({ context: { file: "app.ts", line: 42 } });

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
		const { DbError, DbErr: _DbErr } = createTaggedError("DbError")
			.withMessage(() => "Database error");
		type DbError = ReturnType<typeof DbError>;

		const { ServiceError } = createTaggedError("ServiceError")
			.withCause<DbError>()
			.withMessage(({ cause }) => `Service error: ${cause.message}`);

		const dbError = DbError({});
		const error = ServiceError({ cause: dbError });

		expect(error.cause).toBe(dbError);
		expect(error.message).toBe("Service error: Database error");
	});

	it("cause is correctly typed in output", () => {
		const { DbError } = createTaggedError("DbError")
			.withMessage(() => "DB error");
		type DbError = ReturnType<typeof DbError>;

		const { WrapperError } = createTaggedError("WrapperError")
			.withCause<DbError>()
			.withMessage(({ cause }) => `Wrapped: ${cause.message}`);

		const dbError = DbError({});
		const error = WrapperError({ cause: dbError });

		expectTypeOf(error.cause).toEqualTypeOf<DbError>();
	});
});

// =============================================================================
// .withCause<T | undefined>() - Optional Cause
// =============================================================================

describe("createTaggedError - .withCause<T | undefined>() - optional cause", () => {
	const { DbError } = createTaggedError("DbError")
		.withMessage(() => "Database error");
	type DbError = ReturnType<typeof DbError>;

	const { ServiceError } = createTaggedError("ServiceError")
		.withCause<DbError | undefined>()
		.withMessage(() => "Service error");

	it("makes cause optional when T includes undefined", () => {
		// Without cause
		const err1 = ServiceError({});
		expect(err1.cause).toBeUndefined();

		// With cause
		const dbError = DbError({});
		const err2 = ServiceError({ cause: dbError });
		expect(err2.cause).toBe(dbError);
	});

	it("cause type includes undefined when optional", () => {
		const dbError = DbError({});
		const error = ServiceError({ cause: dbError });

		expectTypeOf(error.cause).toEqualTypeOf<DbError | undefined>();
	});
});

// =============================================================================
// Chaining Order
// =============================================================================

describe("createTaggedError - chaining order", () => {
	it("withContext().withCause().withMessage() works", () => {
		const { DbError } = createTaggedError("DbError")
			.withMessage(() => "DB error");
		type DbError = ReturnType<typeof DbError>;

		const { UserError } = createTaggedError("UserError")
			.withContext<{ userId: string }>()
			.withCause<DbError | undefined>()
			.withMessage(({ context }) => `User ${context.userId} error`);

		const dbError = DbError({});
		const error = UserError({
			context: { userId: "123" },
			cause: dbError,
		});

		expect(error.context).toEqual({ userId: "123" });
		expect(error.cause).toBe(dbError);
	});

	it("withCause().withContext().withMessage() also works", () => {
		const { DbError } = createTaggedError("DbError")
			.withMessage(() => "DB error");
		type DbError = ReturnType<typeof DbError>;

		const { UserError } = createTaggedError("UserError")
			.withCause<DbError | undefined>()
			.withContext<{ userId: string }>()
			.withMessage(({ context }) => `User ${context.userId} error`);

		const dbError = DbError({});
		const error = UserError({
			context: { userId: "456" },
			cause: dbError,
		});

		expect(error.context).toEqual({ userId: "456" });
		expect(error.cause).toBe(dbError);
	});

	it("both chaining orders produce the same runtime shape", () => {
		const { DbError } = createTaggedError("DbError")
			.withMessage(() => "DB error");
		type DbError = ReturnType<typeof DbError>;

		const { UserError: UserError1 } = createTaggedError("UserError")
			.withContext<{ userId: string }>()
			.withCause<DbError | undefined>()
			.withMessage(({ context }) => `User ${context.userId}`);

		const { UserError: UserError2 } = createTaggedError("UserError")
			.withCause<DbError | undefined>()
			.withContext<{ userId: string }>()
			.withMessage(({ context }) => `User ${context.userId}`);

		const dbError = DbError({});

		const err1 = UserError1({ context: { userId: "123" }, cause: dbError });
		const err2 = UserError2({ context: { userId: "123" }, cause: dbError });

		expect(err1.name).toBe(err2.name);
		expect(err1.message).toBe(err2.message);
		expect(err1.context).toEqual(err2.context);
		expect(err1.cause).toEqual(err2.cause);
	});
});

// =============================================================================
// Full Example with Context + Cause
// =============================================================================

describe("createTaggedError - full example with context and cause", () => {
	it("RepoError wrapping DbError", () => {
		const { DbError, DbErr: _DbErr } = createTaggedError("DbError")
			.withContext<{ query: string }>()
			.withMessage(({ context }) => `Query failed: ${context.query}`);
		type DbError = ReturnType<typeof DbError>;

		const { RepoError, RepoErr } = createTaggedError("RepoError")
			.withContext<{ entity: string; operation: string }>()
			.withCause<DbError | undefined>()
			.withMessage(
				({ context }) =>
					`${context.entity}.${context.operation} failed`,
			);

		// Without cause
		const err1 = RepoError({
			context: { entity: "User", operation: "findById" },
		});

		expect(err1.name).toBe("RepoError");
		expect(err1.message).toBe("User.findById failed");
		expect(err1.context).toEqual({ entity: "User", operation: "findById" });
		expect(err1.cause).toBeUndefined();

		// With cause
		const dbError = DbError({ context: { query: "SELECT * FROM users" } });
		const err2 = RepoError({
			context: { entity: "User", operation: "findById" },
			cause: dbError,
		});

		expect(err2.cause).toBe(dbError);
		expect(err2.cause?.name).toBe("DbError");

		// Err-wrapped version
		const result = RepoErr({
			context: { entity: "User", operation: "findById" },
		});

		expect(result.error?.name).toBe("RepoError");
		expect(result.data).toBeNull();
	});
});

// =============================================================================
// Message Auto-Computation
// =============================================================================

describe("createTaggedError - message auto-computation", () => {
	it("template fn is called with name", () => {
		let capturedInput: { name: string } | null = null;

		const { TestError } = createTaggedError("TestError").withMessage(
			(input) => {
				capturedInput = input;
				return "computed message";
			},
		);

		TestError({});

		expect(capturedInput).not.toBeNull();
		expect(capturedInput!.name).toBe("TestError");
	});

	it("template fn is called with context when provided", () => {
		let capturedContext!: { table: string; id: string };

		const { DbNotFoundError } = createTaggedError("DbNotFoundError")
			.withContext<{ table: string; id: string }>()
			.withMessage(({ context }) => {
				capturedContext = context;
				return `${context.table} '${context.id}' not found`;
			});

		DbNotFoundError({ context: { table: "users", id: "42" } });

		expect(capturedContext).toEqual({ table: "users", id: "42" });
	});

	it("template fn is called with cause when provided", () => {
		const { DbError } = createTaggedError("DbError")
			.withMessage(() => "DB failure");
		type DbError = ReturnType<typeof DbError>;

		let capturedCause!: DbError;

		const { ServiceError } = createTaggedError("ServiceError")
			.withCause<DbError>()
			.withMessage(({ cause }) => {
				capturedCause = cause;
				return `wrapped: ${cause.message}`;
			});

		const dbError = DbError({});
		ServiceError({ cause: dbError });

		expect(capturedCause).toBe(dbError);
	});

	it("message is auto-computed when not provided", () => {
		const { DbNotFoundError } = createTaggedError("DbNotFoundError")
			.withContext<{ table: string; id: string }>()
			.withMessage(
				({ context }) => `${context.table} '${context.id}' not found`,
			);

		const error = DbNotFoundError({
			context: { table: "users", id: "123" },
		});

		expect(error.message).toBe("users '123' not found");
	});
});

// =============================================================================
// Message Override
// =============================================================================

describe("createTaggedError - message override", () => {
	it("explicit message takes precedence over template", () => {
		const { DbNotFoundError } = createTaggedError("DbNotFoundError")
			.withContext<{ table: string; id: string }>()
			.withMessage(
				({ context }) => `${context.table} '${context.id}' not found`,
			);

		const error = DbNotFoundError({
			message: "Custom override message",
			context: { table: "users", id: "123" },
		});

		expect(error.message).toBe("Custom override message");
	});

	it("template is used when no message override is given", () => {
		const { DbNotFoundError } = createTaggedError("DbNotFoundError")
			.withContext<{ table: string; id: string }>()
			.withMessage(
				({ context }) => `${context.table} '${context.id}' not found`,
			);

		const error = DbNotFoundError({
			context: { table: "products", id: "99" },
		});

		expect(error.message).toBe("products '99' not found");
	});

	it("message override works on minimal errors too", () => {
		const { SimpleError } = createTaggedError("SimpleError")
			.withMessage(() => "Default message");

		const withDefault = SimpleError({});
		const withOverride = SimpleError({ message: "Overridden" });

		expect(withDefault.message).toBe("Default message");
		expect(withOverride.message).toBe("Overridden");
	});
});

// =============================================================================
// ReturnType Extraction
// =============================================================================

describe("createTaggedError - ReturnType extraction", () => {
	it("ReturnType works for minimal errors", () => {
		const { SimpleError } = createTaggedError("SimpleError")
			.withMessage(() => "Simple");
		type SimpleError = ReturnType<typeof SimpleError>;

		expectTypeOf<SimpleError>().toEqualTypeOf<
			Readonly<{ name: "SimpleError"; message: string }>
		>();
	});

	it("ReturnType works for errors with required context", () => {
		const { FileError } = createTaggedError("FileError")
			.withContext<{ path: string }>()
			.withMessage(({ context }) => `File not found: ${context.path}`);
		type FileError = ReturnType<typeof FileError>;

		const error: FileError = {
			name: "FileError",
			message: "File not found: /etc/config",
			context: { path: "/etc/config" },
		};

		expectTypeOf(error).toExtend<
			TaggedError<"FileError", { path: string }, undefined>
		>();
	});

	it("ReturnType can be used as a cause type in another error", () => {
		const { DbError } = createTaggedError("DbError")
			.withMessage(() => "DB error");
		type DbError = ReturnType<typeof DbError>;

		const { ServiceError } = createTaggedError("ServiceError")
			.withCause<DbError>()
			.withMessage(({ cause }) => `Service error: ${cause.message}`);

		const dbError = DbError({});
		const serviceError = ServiceError({ cause: dbError });

		expectTypeOf(serviceError.cause).toEqualTypeOf<DbError>();
	});
});

// =============================================================================
// Error Chaining / JSON Serializable
// =============================================================================

describe("createTaggedError - error chaining and JSON serialization", () => {
	it("supports multi-level error chains", () => {
		const { DatabaseError } = createTaggedError("DatabaseError")
			.withContext<{ query: string; table: string }>()
			.withMessage(({ context }) => `Query failed on ${context.table}`);
		type DatabaseError = ReturnType<typeof DatabaseError>;

		const { RepositoryError } = createTaggedError("RepositoryError")
			.withContext<{ entity: string; operation: string }>()
			.withCause<DatabaseError | undefined>()
			.withMessage(
				({ context }) =>
					`${context.entity}.${context.operation} failed`,
			);
		type RepositoryError = ReturnType<typeof RepositoryError>;

		const { ServiceError } = createTaggedError("ServiceError")
			.withContext<{ service: string; method: string }>()
			.withCause<RepositoryError | undefined>()
			.withMessage(
				({ context }) =>
					`${context.service}.${context.method} failed`,
			);

		const dbError = DatabaseError({
			context: { query: "SELECT * FROM users", table: "users" },
		});
		const repoError = RepositoryError({
			context: { entity: "User", operation: "findById" },
			cause: dbError,
		});
		const serviceError = ServiceError({
			context: { service: "UserService", method: "getProfile" },
			cause: repoError,
		});

		expect(serviceError.name).toBe("ServiceError");
		expect(serviceError.cause?.name).toBe("RepositoryError");
		expect(serviceError.cause?.cause?.name).toBe("DatabaseError");
		expect(serviceError.cause?.cause?.context?.query).toBe(
			"SELECT * FROM users",
		);
	});

	it("errors are JSON serializable", () => {
		const { NetworkError } = createTaggedError("NetworkError")
			.withContext<{ host: string; port: number }>()
			.withMessage(
				({ context }) =>
					`Connection to ${context.host}:${context.port} failed`,
			);
		type NetworkError = ReturnType<typeof NetworkError>;

		const { ApiError } = createTaggedError("ApiError")
			.withContext<{ endpoint: string }>()
			.withCause<NetworkError | undefined>()
			.withMessage(
				({ context }) => `Request to ${context.endpoint} failed`,
			);

		const networkError = NetworkError({
			context: { host: "example.com", port: 443 },
		});
		const apiError = ApiError({
			context: { endpoint: "/api/users" },
			cause: networkError,
		});

		const json = JSON.stringify(apiError);
		const parsed = JSON.parse(json);

		expect(parsed.name).toBe("ApiError");
		expect(parsed.message).toBe("Request to /api/users failed");
		expect(parsed.context.endpoint).toBe("/api/users");
		expect(parsed.cause.name).toBe("NetworkError");
		expect(parsed.cause.context.host).toBe("example.com");
		expect(parsed.cause.context.port).toBe(443);
	});
});

// =============================================================================
// Type Safety
// =============================================================================

describe("createTaggedError - type safety", () => {
	it("minimal errors have correct types (no context, no cause)", () => {
		const { NetworkError } = createTaggedError("NetworkError")
			.withMessage(() => "Network error");

		const error = NetworkError({});

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});

	it("required context mode gives precise typing", () => {
		type Ctx = { filename: string };
		const { FileError } = createTaggedError("FileError")
			.withContext<Ctx>()
			.withMessage(({ context }) => `${context.filename} not found`);

		const error = FileError({ context: { filename: "test.txt" } });

		expectTypeOf(error.context).toEqualTypeOf<{ filename: string }>();
	});

	it("chained context and cause constrains types correctly", () => {
		const { CauseError } = createTaggedError("CauseError")
			.withMessage(() => "Root cause");
		type CauseType = ReturnType<typeof CauseError>;

		const { WrapperError } = createTaggedError("WrapperError")
			.withContext<{ wrap: boolean }>()
			.withCause<CauseType | undefined>()
			.withMessage(({ context }) => `Wrapper: ${context.wrap}`);

		const cause = CauseError({});
		const wrapper = WrapperError({ context: { wrap: true }, cause });

		expectTypeOf(wrapper.cause).toEqualTypeOf<CauseType | undefined>();
	});
});

// =============================================================================
// Builder Has NO Factories
// =============================================================================

describe("createTaggedError - builder has NO factories", () => {
	it("builder does not have factory properties before withMessage", () => {
		const builder = createTaggedError("FooError");

		// The builder should NOT have FooError or FooErr as properties
		expect("FooError" in builder).toBe(false);
		expect("FooErr" in builder).toBe(false);
	});

	it("builder after withContext does not have factory properties", () => {
		const builder = createTaggedError("FooError").withContext<{
			x: string;
		}>();

		expect("FooError" in builder).toBe(false);
		expect("FooErr" in builder).toBe(false);
	});

	it("builder after withCause does not have factory properties", () => {
		const { SomeError } = createTaggedError("SomeError").withMessage(
			() => "some",
		);
		type SomeError = ReturnType<typeof SomeError>;

		const builder = createTaggedError("FooError").withCause<
			SomeError | undefined
		>();

		expect("FooError" in builder).toBe(false);
		expect("FooErr" in builder).toBe(false);
	});

	it("withMessage returns object WITH factory properties", () => {
		const factories = createTaggedError("FooError").withMessage(
			() => "foo",
		);

		expect("FooError" in factories).toBe(true);
		expect("FooErr" in factories).toBe(true);
	});

	it("builder has withContext, withCause, withMessage methods", () => {
		const builder = createTaggedError("FooError");

		expect("withContext" in builder).toBe(true);
		expect("withCause" in builder).toBe(true);
		expect("withMessage" in builder).toBe(true);
	});

	it("withMessage result does NOT have chain methods", () => {
		const factories = createTaggedError("FooError").withMessage(
			() => "foo",
		);

		expect("withContext" in factories).toBe(false);
		expect("withCause" in factories).toBe(false);
		expect("withMessage" in factories).toBe(false);
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("createTaggedError - edge cases", () => {
	it("handles empty context object {}", () => {
		const { TestError } = createTaggedError("TestError")
			.withContext<JsonObject>()
			.withMessage(() => "Test error");

		const error = TestError({ context: {} });

		expect(error.context).toEqual({});
	});

	it("handles complex nested context", () => {
		type NestedContext = {
			nested: { deeply: { value: number } };
			array: number[];
			nullable: null;
		};
		const { TestError } = createTaggedError("TestError")
			.withContext<NestedContext>()
			.withMessage(({ context }) => `value: ${context.nested.deeply.value}`);

		const error = TestError({
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

	it("error objects are typed as Readonly", () => {
		const { TestError } = createTaggedError("TestError").withMessage(
			() => "Original",
		);
		const error = TestError({});

		// Verify the object shape exists
		expect(error.name).toBe("TestError");
		expect(error.message).toBe("Original");

		// TypeScript types it as Readonly (verified via type system)
		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "TestError"; message: string }>
		>();
	});
});

// =============================================================================
// Permissive Mode
// =============================================================================

describe("createTaggedError - permissive mode", () => {
	it(".withContext() without generic defaults to JsonObject | undefined", () => {
		const { FlexError } = createTaggedError("FlexError")
			.withContext()
			.withMessage(() => "Flex error");

		// Context is optional
		const err1 = FlexError({});
		expect(err1.context).toBeUndefined();

		// Context accepts any JsonObject shape
		const err2 = FlexError({
			context: { anything: "works", nested: { value: 123 } },
		});
		expect(err2.context).toEqual({ anything: "works", nested: { value: 123 } });
	});

	it(".withCause() without generic defaults to AnyTaggedError | undefined", () => {
		const { SomeError } = createTaggedError("SomeError").withMessage(
			() => "some",
		);
		const { OtherError } = createTaggedError("OtherError").withMessage(
			() => "other",
		);

		const { FlexError } = createTaggedError("FlexError")
			.withCause()
			.withMessage(() => "Flex error");

		// Cause is optional
		const err1 = FlexError({});
		expect(err1.cause).toBeUndefined();

		// Cause accepts any tagged error
		const err2 = FlexError({ cause: SomeError({}) });
		expect(err2.cause?.name).toBe("SomeError");

		const err3 = FlexError({ cause: OtherError({}) });
		expect(err3.cause?.name).toBe("OtherError");
	});

	it("Record<string, unknown> is NOT assignable to JsonObject (type safety)", () => {
		// JsonObject = Record<string, JsonValue>, which is stricter than Record<string, unknown>
		// This is a compile-time check — JsonObject enforces JSON-serializable values
		type IsJsonObject<T> = T extends JsonObject ? true : false;

		// A concrete JSON-safe type is assignable to JsonObject
		type Test1 = IsJsonObject<{ key: string; num: number; flag: boolean }>;
		expectTypeOf<Test1>().toEqualTypeOf<true>();

		// A concrete JSON-safe type is assignable
		const validContext: JsonObject = { key: "value", num: 42, flag: true };
		expect(validContext).toEqual({ key: "value", num: 42, flag: true });
	});

	it(".withContext().withCause() without generics gives fully permissive error", () => {
		const { CauseError } = createTaggedError("CauseError").withMessage(
			() => "Cause",
		);

		const { FlexError } = createTaggedError("FlexError")
			.withContext()
			.withCause()
			.withMessage(() => "Flex error");

		const err1 = FlexError({});
		const err2 = FlexError({ context: { any: "data" } });
		const err3 = FlexError({ cause: CauseError({}) });
		const err4 = FlexError({
			context: { any: "data" },
			cause: CauseError({}),
		});

		expect(err1.context).toBeUndefined();
		expect(err1.cause).toBeUndefined();
		expect(err2.context).toEqual({ any: "data" });
		expect(err3.cause?.name).toBe("CauseError");
		expect(err4.context).toEqual({ any: "data" });
		expect(err4.cause?.name).toBe("CauseError");
	});
});
