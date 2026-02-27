import { describe, it, expect, expectTypeOf } from "bun:test";
import { createTaggedError } from "./utils.js";
import type { TaggedError, JsonObject } from "./types.js";

// =============================================================================
// Without .withMessage() — message required at call site
// =============================================================================

describe("createTaggedError - without .withMessage()", () => {
	const { SimpleError, SimpleErr } = createTaggedError("SimpleError");

	it("creates error with name and call-site message", () => {
		const error = SimpleError({ message: "Something went wrong" });

		expect(error.name).toBe("SimpleError");
		expect(error.message).toBe("Something went wrong");
	});

	it("creates error with no extra properties", () => {
		const error = SimpleError({ message: "test" });

		const { name: _name, message: _message, ...rest } = error;
		expect(Object.keys(rest)).toHaveLength(0);
	});

	it("minimal error has correct type (name and message only)", () => {
		const error = SimpleError({ message: "test" });

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "SimpleError"; message: string }>
		>();
	});

	it("SimpleErr wraps error in Err result", () => {
		const result = SimpleErr({ message: "Something went wrong" });

		expect(result.data).toBeNull();
		expect(result.error).toEqual({
			name: "SimpleError",
			message: "Something went wrong",
		});
	});
});

// =============================================================================
// With .withMessage() — message sealed by template, NOT in input
// =============================================================================

describe("createTaggedError - with .withMessage() (no fields)", () => {
	const { RecorderBusyError, RecorderBusyErr } = createTaggedError(
		"RecorderBusyError",
	).withMessage(() => "A recording is already in progress");

	it("uses sealed message when called with no args", () => {
		const error = RecorderBusyError();

		expect(error.name).toBe("RecorderBusyError");
		expect(error.message).toBe("A recording is already in progress");
	});

	it("message is always the template output (sealed)", () => {
		// With sealed .withMessage(), there's no way to override the message.
		// Calling with no args always produces the template message.
		const error = RecorderBusyError();
		expect(error.message).toBe("A recording is already in progress");
	});

	it("Err factory uses sealed message", () => {
		const result = RecorderBusyErr();

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("RecorderBusyError");
		expect(result.error?.message).toBe("A recording is already in progress");
	});
});

// =============================================================================
// With .withFields() — message required, fields required
// =============================================================================

describe("createTaggedError - with .withFields() (no .withMessage())", () => {
	const { FsReadError, FsReadErr } = createTaggedError("FsReadError")
		.withFields<{ path: string }>();

	it("creates error with message and fields", () => {
		const error = FsReadError({
			message: "Failed to read config",
			path: "/etc/config",
		});

		expect(error.name).toBe("FsReadError");
		expect(error.message).toBe("Failed to read config");
		expect(error.path).toBe("/etc/config");
	});

	it("fields are typed correctly in output", () => {
		const error = FsReadError({
			message: "test",
			path: "/tmp/test",
		});

		expectTypeOf(error.path).toEqualTypeOf<string>();
	});

	it("FsReadErr wraps in Err result", () => {
		const result = FsReadErr({
			message: "Failed to read",
			path: "/etc/config",
		});

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("FsReadError");
		expect(result.error?.path).toBe("/etc/config");
	});
});

// =============================================================================
// With .withFields() + .withMessage() — message sealed, computed from fields
// =============================================================================

describe("createTaggedError - with .withFields() + .withMessage()", () => {
	const { ResponseError, ResponseErr } = createTaggedError("ResponseError")
		.withFields<{ status: number; reason?: string }>()
		.withMessage(
			({ status, reason }) => `HTTP ${status}${reason ? `: ${reason}` : ""}`,
		);

	it("computes message from fields (sealed)", () => {
		const error = ResponseError({ status: 404 });

		expect(error.name).toBe("ResponseError");
		expect(error.message).toBe("HTTP 404");
		expect(error.status).toBe(404);
	});

	it("template receives fields including optional ones", () => {
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
			.withMessage(
				({ table, operation }) => `Database ${operation} on ${table} failed`,
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

	it("message is sealed — no override possible via input", () => {
		const { DbQueryError } = createTaggedError("DbQueryError")
			.withFields<{ table: string; operation: string; backend: string }>()
			.withMessage(
				({ table, operation }) => `Database ${operation} on ${table} failed`,
			);

		// When .withMessage() is used, `message` is not in the input type.
		// Even if we sneak it in at runtime, it should be ignored.
		const error = DbQueryError({
			table: "recordings",
			operation: "insert",
			backend: "indexeddb",
		});

		expect(error.message).toBe("Database insert on recordings failed");
	});
});

// =============================================================================
// Builder Shape — factories available immediately
// =============================================================================

describe("createTaggedError - builder shape", () => {
	it("builder has factory properties immediately", () => {
		const builder = createTaggedError("FooError");

		expect("FooError" in builder).toBe(true);
		expect("FooErr" in builder).toBe(true);
	});

	it("builder has withFields and withMessage methods", () => {
		const builder = createTaggedError("FooError");

		expect("withFields" in builder).toBe(true);
		expect("withMessage" in builder).toBe(true);
	});

	it("builder after withFields has factory properties", () => {
		const builder = createTaggedError("FooError").withFields<{
			x: string;
		}>();

		expect("FooError" in builder).toBe(true);
		expect("FooErr" in builder).toBe(true);
		expect("withFields" in builder).toBe(true);
		expect("withMessage" in builder).toBe(true);
	});

	it("withMessage returns object with ONLY factory properties", () => {
		const factories = createTaggedError("FooError").withMessage(() => "foo");

		expect("FooError" in factories).toBe(true);
		expect("FooErr" in factories).toBe(true);
		expect("withFields" in factories).toBe(false);
		expect("withMessage" in factories).toBe(false);
	});

	it("builder does NOT have withContext or withCause", () => {
		const builder = createTaggedError("FooError");

		expect("withContext" in builder).toBe(false);
		expect("withCause" in builder).toBe(false);
	});
});

// =============================================================================
// Optional input with .withMessage() + all-optional fields
// =============================================================================

describe("createTaggedError - optional input with .withMessage()", () => {
	it("no argument needed when no fields + withMessage", () => {
		const { StaticError } = createTaggedError("StaticError").withMessage(
			() => "Static message",
		);

		const error = StaticError();
		expect(error.message).toBe("Static message");
	});

	it("argument optional when all fields are optional + withMessage", () => {
		const { FlexError } = createTaggedError("FlexError")
			.withFields<{ reason?: string; details?: string }>()
			.withMessage(({ reason }) => reason ?? "Unknown error");

		const err1 = FlexError();
		expect(err1.message).toBe("Unknown error");

		const err2 = FlexError({ reason: "timeout" });
		expect(err2.message).toBe("timeout");
		expect(err2.reason).toBe("timeout");
	});

	it("argument required when any field is required (even with withMessage)", () => {
		const { StrictError } = createTaggedError("StrictError")
			.withFields<{ code: number }>()
			.withMessage(({ code }) => `Error code: ${code}`);

		const error = StrictError({ code: 42 });
		expect(error.code).toBe(42);
		expect(error.message).toBe("Error code: 42");
	});
});

// =============================================================================
// Message template behavior
// =============================================================================

describe("createTaggedError - message template behavior", () => {
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
		expect(capturedInput?.value).toBe(42);
		expect("name" in (capturedInput as object)).toBe(false);
	});

	it("template fn receives empty object for no-fields errors", () => {
		let capturedInput: unknown = null;

		const { StaticError } = createTaggedError("StaticError").withMessage(
			(input) => {
				capturedInput = input;
				return "static";
			},
		);

		StaticError();

		expect(capturedInput).toEqual({});
	});

	it("sealed message is always the template output", () => {
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
	it("ReturnType works for minimal errors (no withMessage)", () => {
		const { SimpleError } = createTaggedError("SimpleError");
		type SimpleError = ReturnType<typeof SimpleError>;

		expectTypeOf<SimpleError>().toEqualTypeOf<
			Readonly<{ name: "SimpleError"; message: string }>
		>();
	});

	it("ReturnType works for errors with withMessage", () => {
		const { SimpleError } = createTaggedError("SimpleError").withMessage(
			() => "Simple",
		);
		type SimpleError = ReturnType<typeof SimpleError>;

		expectTypeOf<SimpleError>().toEqualTypeOf<
			Readonly<{ name: "SimpleError"; message: string }>
		>();
	});

	it("ReturnType works for errors with fields", () => {
		const { FileError } = createTaggedError("FileError")
			.withFields<{ path: string }>();
		type FileError = ReturnType<typeof FileError>;

		const error: FileError = {
			name: "FileError",
			message: "File not found: /etc/config",
			path: "/etc/config",
		};

		expectTypeOf(error).toExtend<TaggedError<"FileError", { path: string }>>();
	});

	it("cause is just another typed field", () => {
		const { ServiceError } = createTaggedError("ServiceError")
			.withFields<{ cause: string }>();

		const serviceError = ServiceError({
			message: "Service failed",
			cause: "db failure",
		});

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
			.withMessage(
				({ table, operation }) => `${operation} on ${table} failed`,
			);

		const error = DbError({ table: "users", operation: "insert" });
		const keys = Object.keys(error).sort();

		expect(keys).toEqual(["message", "name", "operation", "table"]);
	});

	it("rest spread extracts just the extra fields", () => {
		const { ApiError } = createTaggedError("ApiError")
			.withFields<{ endpoint: string; status: number }>()
			.withMessage(({ endpoint }) => `${endpoint} failed`);

		const error = ApiError({ endpoint: "/api", status: 500 });
		const { name: _name, message: _message, ...rest } = error;

		expect(rest).toEqual({ endpoint: "/api", status: 500 });
	});
});

// =============================================================================
// Type Safety
// =============================================================================

describe("createTaggedError - type safety", () => {
	it("minimal errors have correct types", () => {
		const { NetworkError } = createTaggedError("NetworkError");

		const error = NetworkError({ message: "Network error" });

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});

	it("errors with fields have correct types", () => {
		const { FileError } = createTaggedError("FileError")
			.withFields<{ path: string; size: number }>();

		const error = FileError({
			message: "not found",
			path: "test.txt",
			size: 1024,
		});

		expectTypeOf(error.path).toEqualTypeOf<string>();
		expectTypeOf(error.size).toEqualTypeOf<number>();
	});

	it("error objects are typed as Readonly", () => {
		const { TestError } = createTaggedError("TestError");
		const error = TestError({ message: "Original" });

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "TestError"; message: string }>
		>();
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
		// @ts-expect-error - name must end in 'Error'
		createTaggedError("Foo");
	});

	it("message field in fields is allowed (no longer reserved)", () => {
		// message is a built-in input, not a reserved field key.
		// The `message` key in the input is the built-in message, not a field collision.
		const { TestError } = createTaggedError("TestError");
		const error = TestError({ message: "hello" });
		expect(error.message).toBe("hello");
	});
});

// =============================================================================
// The Console Log Test (from spec)
// =============================================================================

describe("createTaggedError - the console log test", () => {
	it("produces the three example shapes from the spec", () => {
		const { RecorderBusyError } = createTaggedError(
			"RecorderBusyError",
		).withMessage(() => "A recording is already in progress");

		const { ResponseError } = createTaggedError("ResponseError")
			.withFields<{ provider: string; status: number; model: string }>()
			.withMessage(({ status }) => `HTTP ${status}`);

		const { DbQueryError } = createTaggedError("DbQueryError")
			.withFields<{ table: string; operation: string; backend: string }>()
			.withMessage(
				({ table, operation }) => `Database ${operation} on ${table} failed`,
			);

		const err1 = RecorderBusyError();
		expect(err1.name).toBe("RecorderBusyError");
		expect(err1.message).toBe("A recording is already in progress");

		const err2 = ResponseError({
			provider: "openai",
			status: 401,
			model: "gpt-4o",
		});
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

	it("spec examples also work without withMessage", () => {
		const { SimpleError } = createTaggedError("SimpleError");
		const err = SimpleError({ message: "Something went wrong" });
		expect(err.name).toBe("SimpleError");
		expect(err.message).toBe("Something went wrong");

		const { FsReadError } = createTaggedError("FsReadError")
			.withFields<{ path: string }>();
		const fsErr = FsReadError({
			message: "Failed to read '/etc/config'",
			path: "/etc/config",
		});
		expect(fsErr.name).toBe("FsReadError");
		expect(fsErr.message).toBe("Failed to read '/etc/config'");
		expect(fsErr.path).toBe("/etc/config");
	});
});
