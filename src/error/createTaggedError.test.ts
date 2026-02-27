import { describe, it, expect, expectTypeOf } from "bun:test";
import { createTaggedError } from "./utils.js";
import type { TaggedError, JsonObject } from "./types.js";

// =============================================================================
// Tier 1: Static Errors (no fields, no arguments)
// =============================================================================

describe("createTaggedError - Tier 1: static errors", () => {
	const { NetworkError, NetworkErr } = createTaggedError("NetworkError")
		.withMessage(() => "Connection failed");

	it("creates error with correct name and message from template", () => {
		const error = NetworkError();

		expect(error.name).toBe("NetworkError");
		expect(error.message).toBe("Connection failed");
	});

	it("creates error with no extra properties", () => {
		const error = NetworkError();

		const { name, message, ...rest } = error;
		expect(Object.keys(rest)).toHaveLength(0);
	});

	it("minimal error has correct type (name and message only)", () => {
		const error = NetworkError();

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});

	it("NetworkErr wraps error in Err result", () => {
		const result = NetworkErr();

		expect(result.data).toBeNull();
		expect(result.error).toEqual({
			name: "NetworkError",
			message: "Connection failed",
		});
	});

	it("no argument needed for static errors", () => {
		const { RecorderBusyError } = createTaggedError("RecorderBusyError")
			.withMessage(() => "A recording is already in progress");

		const error = RecorderBusyError();
		expect(error.name).toBe("RecorderBusyError");
		expect(error.message).toBe("A recording is already in progress");
	});
});

// =============================================================================
// Tier 2: Reason-Only Errors
// =============================================================================

describe("createTaggedError - Tier 2: reason-only errors", () => {
	const { PlaySoundError, PlaySoundErr } = createTaggedError("PlaySoundError")
		.withFields<{ reason: string }>()
		.withMessage(({ reason }) => `Failed to play sound: ${reason}`);

	it("creates error with reason field spread flat", () => {
		const error = PlaySoundError({ reason: "device busy" });

		expect(error.name).toBe("PlaySoundError");
		expect(error.message).toBe("Failed to play sound: device busy");
		expect(error.reason).toBe("device busy");
	});

	it("reason is accessible as a top-level property", () => {
		const error = PlaySoundError({ reason: "not found" });

		expectTypeOf(error.reason).toEqualTypeOf<string>();
	});

	it("PlaySoundErr wraps in Err result", () => {
		const result = PlaySoundErr({ reason: "codec error" });

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("PlaySoundError");
		expect(result.error?.reason).toBe("codec error");
	});
});

// =============================================================================
// Tier 3: Structured Data Errors
// =============================================================================

describe("createTaggedError - Tier 3: structured data errors", () => {
	const { ResponseError, ResponseErr } = createTaggedError("ResponseError")
		.withFields<{ status: number; reason?: string }>()
		.withMessage(({ status, reason }) =>
			`HTTP ${status}${reason ? `: ${reason}` : ""}`,
		);

	it("creates error with required fields", () => {
		const error = ResponseError({ status: 404 });

		expect(error.name).toBe("ResponseError");
		expect(error.message).toBe("HTTP 404");
		expect(error.status).toBe(404);
	});

	it("creates error with required + optional fields", () => {
		const error = ResponseError({ status: 500, reason: "Internal error" });

		expect(error.message).toBe("HTTP 500: Internal error");
		expect(error.status).toBe(500);
		expect(error.reason).toBe("Internal error");
	});

	it("fields are typed correctly in output", () => {
		const error = ResponseError({ status: 200 });

		expectTypeOf(error.status).toEqualTypeOf<number>();
		expectTypeOf(error.reason).toEqualTypeOf<string | undefined>();
	});

	it("ResponseErr wraps in Err result", () => {
		const result = ResponseErr({ status: 503 });

		expect(result.data).toBeNull();
		expect(result.error?.status).toBe(503);
	});

	it("multi-field error with complex types", () => {
		const { DbQueryError } = createTaggedError("DbQueryError")
			.withFields<{ table: string; operation: string; backend: string }>()
			.withMessage(({ table, operation }) =>
				`Database ${operation} on ${table} failed`,
			);

		const error = DbQueryError({
			table: "recordings",
			operation: "insert",
			backend: "indexeddb",
		});

		expect(error.name).toBe("DbQueryError");
		expect(error.message).toBe("Database insert on recordings failed");
		expect(error.table).toBe("recordings");
		expect(error.operation).toBe("insert");
		expect(error.backend).toBe("indexeddb");
	});
});

// =============================================================================
// Err-Wrapped Factory
// =============================================================================

describe("createTaggedError - Err-wrapped factory (FooErr)", () => {
	it("FooErr wraps error in Err result with correct data/error shape", () => {
		const { AuthErr } = createTaggedError("AuthError")
			.withMessage(() => "Authentication failed");

		const result = AuthErr();

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("AuthError");
		expect(result.error?.message).toBe("Authentication failed");
	});

	it("FooErr with fields wraps correctly", () => {
		const { ApiErr } = createTaggedError("ApiError")
			.withFields<{ endpoint: string; status: number }>()
			.withMessage(
				({ endpoint, status }) =>
					`Request to ${endpoint} failed with ${status}`,
			);

		const result = ApiErr({ endpoint: "/users", status: 500 });

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("ApiError");
		expect(result.error?.message).toBe(
			"Request to /users failed with 500",
		);
	});
});

// =============================================================================
// Optional Input (all fields optional or empty)
// =============================================================================

describe("createTaggedError - optional input", () => {
	it("no argument needed when no fields defined", () => {
		const { SimpleError } = createTaggedError("SimpleError")
			.withMessage(() => "Simple");

		const error = SimpleError();
		expect(error.message).toBe("Simple");
	});

	it("argument optional when all fields are optional", () => {
		const { FlexError } = createTaggedError("FlexError")
			.withFields<{ reason?: string; details?: string }>()
			.withMessage(({ reason }) => reason ?? "Unknown error");

		// Without argument
		const err1 = FlexError();
		expect(err1.message).toBe("Unknown error");

		// With argument
		const err2 = FlexError({ reason: "timeout" });
		expect(err2.message).toBe("timeout");
		expect(err2.reason).toBe("timeout");
	});

	it("argument required when any field is required", () => {
		const { StrictError } = createTaggedError("StrictError")
			.withFields<{ code: number }>()
			.withMessage(({ code }) => `Error code: ${code}`);

		const error = StrictError({ code: 42 });
		expect(error.code).toBe(42);
	});
});

// =============================================================================
// Message Auto-Computation
// =============================================================================

describe("createTaggedError - message auto-computation", () => {
	it("template fn receives fields (not name)", () => {
		let capturedInput: Record<string, unknown> | null = null;

		const { TestError } = createTaggedError("TestError")
			.withFields<{ value: number }>()
			.withMessage((input) => {
				capturedInput = input as Record<string, unknown>;
				return "computed";
			});

		TestError({ value: 42 });

		expect(capturedInput).not.toBeNull();
		expect(capturedInput!.value).toBe(42);
		// name is NOT passed to the message function
		expect("name" in capturedInput!).toBe(false);
	});

	it("template fn receives empty object for static errors", () => {
		let capturedInput: unknown = null;

		const { StaticError } = createTaggedError("StaticError")
			.withMessage((input) => {
				capturedInput = input;
				return "static";
			});

		StaticError();

		expect(capturedInput).toEqual({});
	});

	it("message is always computed by template, never overridable", () => {
		const { TemplateError } = createTaggedError("TemplateError")
			.withFields<{ reason: string }>()
			.withMessage(({ reason }) => `Template says: ${reason}`);

		const error = TemplateError({ reason: "test" });

		expect(error.message).toBe("Template says: test");
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

	it("ReturnType works for errors with fields", () => {
		const { FileError } = createTaggedError("FileError")
			.withFields<{ path: string }>()
			.withMessage(({ path }) => `File not found: ${path}`);
		type FileError = ReturnType<typeof FileError>;

		const error: FileError = {
			name: "FileError",
			message: "File not found: /etc/config",
			path: "/etc/config",
		};

		expectTypeOf(error).toExtend<
			TaggedError<"FileError", { path: string }>
		>();
	});

	it("ReturnType can be used as a field type in another error", () => {
		// cause is just another typed field — no special machinery
		const { ServiceError } = createTaggedError("ServiceError")
			.withFields<{ cause: string }>()
			.withMessage(({ cause }) => `Service error: ${cause}`);

		const serviceError = ServiceError({ cause: "db failure" });

		expect(serviceError.cause).toBe("db failure");
	});
});

// =============================================================================
// JSON Serialization
// =============================================================================

describe("createTaggedError - JSON serialization", () => {
	it("flat errors round-trip through JSON perfectly", () => {
		const { ResponseError } = createTaggedError("ResponseError")
			.withFields<{ status: number; provider: string }>()
			.withMessage(({ status }) => `HTTP ${status}`);

		const error = ResponseError({ status: 401, provider: "openai" });

		const json = JSON.stringify(error);
		const parsed = JSON.parse(json);

		expect(parsed.name).toBe("ResponseError");
		expect(parsed.message).toBe("HTTP 401");
		expect(parsed.status).toBe(401);
		expect(parsed.provider).toBe("openai");
	});

	it("no nested structure to worry about", () => {
		const { DbError } = createTaggedError("DbError")
			.withFields<{ table: string; operation: string }>()
			.withMessage(({ table, operation }) => `${operation} on ${table} failed`);

		const error = DbError({ table: "users", operation: "insert" });
		const keys = Object.keys(error).sort();

		expect(keys).toEqual(["message", "name", "operation", "table"]);
	});

	it("rest spread extracts just the extra fields", () => {
		const { ApiError } = createTaggedError("ApiError")
			.withFields<{ endpoint: string; status: number }>()
			.withMessage(({ endpoint }) => `${endpoint} failed`);

		const error = ApiError({ endpoint: "/api", status: 500 });
		const { name, message, ...rest } = error;

		expect(rest).toEqual({ endpoint: "/api", status: 500 });
	});
});

// =============================================================================
// Type Safety
// =============================================================================

describe("createTaggedError - type safety", () => {
	it("minimal errors have correct types (name and message only)", () => {
		const { NetworkError } = createTaggedError("NetworkError")
			.withMessage(() => "Network error");

		const error = NetworkError();

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});

	it("fields are typed correctly in output", () => {
		const { FileError } = createTaggedError("FileError")
			.withFields<{ path: string; size: number }>()
			.withMessage(({ path }) => `${path} not found`);

		const error = FileError({ path: "test.txt", size: 1024 });

		expectTypeOf(error.path).toEqualTypeOf<string>();
		expectTypeOf(error.size).toEqualTypeOf<number>();
	});

	it("error objects are typed as Readonly", () => {
		const { TestError } = createTaggedError("TestError")
			.withMessage(() => "Original");
		const error = TestError();

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "TestError"; message: string }>
		>();
	});
});

// =============================================================================
// Builder Has NO Factories
// =============================================================================

describe("createTaggedError - builder has NO factories", () => {
	it("builder does not have factory properties before withMessage", () => {
		const builder = createTaggedError("FooError");

		expect("FooError" in builder).toBe(false);
		expect("FooErr" in builder).toBe(false);
	});

	it("builder after withFields does not have factory properties", () => {
		const builder = createTaggedError("FooError").withFields<{
			x: string;
		}>();

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

	it("builder has withFields and withMessage methods", () => {
		const builder = createTaggedError("FooError");

		expect("withFields" in builder).toBe(true);
		expect("withMessage" in builder).toBe(true);
	});

	it("builder does NOT have withContext or withCause", () => {
		const builder = createTaggedError("FooError");

		expect("withContext" in builder).toBe(false);
		expect("withCause" in builder).toBe(false);
	});

	it("withMessage result does NOT have chain methods", () => {
		const factories = createTaggedError("FooError").withMessage(
			() => "foo",
		);

		expect("withFields" in factories).toBe(false);
		expect("withMessage" in factories).toBe(false);
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("createTaggedError - edge cases", () => {
	it("handles complex nested JSON values in fields", () => {
		type NestedFields = {
			nested: { deeply: { value: number } };
			array: number[];
			nullable: null;
		};
		const { TestError } = createTaggedError("TestError")
			.withFields<NestedFields>()
			.withMessage(({ nested }) => `value: ${nested.deeply.value}`);

		const error = TestError({
			nested: { deeply: { value: 123 } },
			array: [1, 2, 3],
			nullable: null,
		});

		expect(error.nested.deeply.value).toBe(123);
		expect(error.array).toEqual([1, 2, 3]);
		expect(error.nullable).toBeNull();
	});

	it("handles empty fields object", () => {
		const { TestError } = createTaggedError("TestError")
			.withFields<JsonObject>()
			.withMessage(() => "Test error");

		const error = TestError({});

		expect(error.name).toBe("TestError");
	});

	it("cause is just another field if you want it", () => {
		const { BackendError } = createTaggedError("BackendError")
			.withFields<{ backend: string; cause: string }>()
			.withMessage(({ backend }) => `${backend} failed`);

		const error = BackendError({ backend: "postgres", cause: "timeout" });

		expect(error.backend).toBe("postgres");
		expect(error.cause).toBe("timeout");
	});

	it("error name must end in 'Error'", () => {
		// This is enforced at the type level via template literal constraint
		// @ts-expect-error - name must end in 'Error'
		createTaggedError("Foo");
	});
});

// =============================================================================
// The Console Log Test (from spec)
// =============================================================================

describe("createTaggedError - the console log test", () => {
	it("produces the three example shapes from the spec", () => {
		const { RecorderBusyError } = createTaggedError("RecorderBusyError")
			.withMessage(() => "A recording is already in progress");

		const { ResponseError } = createTaggedError("ResponseError")
			.withFields<{ provider: string; status: number; model: string }>()
			.withMessage(({ status }) => `HTTP ${status}`);

		const { DbQueryError } = createTaggedError("DbQueryError")
			.withFields<{ table: string; operation: string; backend: string }>()
			.withMessage(
				({ table, operation }) =>
					`Database ${operation} on ${table} failed`,
			);

		const err1 = RecorderBusyError();
		expect(err1.name).toBe("RecorderBusyError");
		expect(err1.message).toBe("A recording is already in progress");

		const err2 = ResponseError({ provider: "openai", status: 401, model: "gpt-4o" });
		expect(err2.name).toBe("ResponseError");
		expect(err2.message).toBe("HTTP 401");
		expect(err2.provider).toBe("openai");
		expect(err2.status).toBe(401);
		expect(err2.model).toBe("gpt-4o");

		const err3 = DbQueryError({
			table: "recordings",
			operation: "insert",
			backend: "indexeddb",
		});
		expect(err3.name).toBe("DbQueryError");
		expect(err3.message).toBe("Database insert on recordings failed");
		expect(err3.table).toBe("recordings");
	});
});
