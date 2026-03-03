import { describe, it, expect, expectTypeOf } from "bun:test";
import { defineErrors } from "./defineErrors.js";
import type {
	AnyTaggedError,
	InferError,
	InferErrorUnion,
	JsonObject,
} from "./types.js";

// =============================================================================
// Basic factories — message at call site equivalent
// =============================================================================

describe("defineErrors - call-site message (replaces no .withMessage())", () => {
	const errors = defineErrors({
		SimpleError: ({ message }: { message: string }) => ({ message }),
	});
	const { SimpleError, SimpleErr } = errors;

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
// Static message — zero-arg factory (replaces .withMessage() no fields)
// =============================================================================

describe("defineErrors - static message (replaces .withMessage() no fields)", () => {
	const errors = defineErrors({
		RecorderBusyError: () => ({
			message: "A recording is already in progress",
		}),
	});
	const { RecorderBusyError, RecorderBusyErr } = errors;

	it("uses sealed message when called with no args", () => {
		const error = RecorderBusyError();

		expect(error.name).toBe("RecorderBusyError");
		expect(error.message).toBe("A recording is already in progress");
	});

	it("message is always the constructor output", () => {
		const error = RecorderBusyError();
		expect(error.message).toBe("A recording is already in progress");
	});

	it("Err factory uses the message", () => {
		const result = RecorderBusyErr();

		expect(result.data).toBeNull();
		expect(result.error?.name).toBe("RecorderBusyError");
		expect(result.error?.message).toBe("A recording is already in progress");
	});
});

// =============================================================================
// Fields + call-site message (replaces .withFields() no .withMessage())
// =============================================================================

describe("defineErrors - fields + call-site message (replaces .withFields())", () => {
	const errors = defineErrors({
		FsReadError: ({ message, path }: { message: string; path: string }) => ({
			message,
			path,
		}),
	});
	const { FsReadError, FsReadErr } = errors;

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
		const error = FsReadError({ message: "test", path: "/tmp/test" });

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
// Computed message from fields (replaces .withFields() + .withMessage())
// =============================================================================

describe("defineErrors - computed message from fields", () => {
	const errors = defineErrors({
		ResponseError: ({
			status,
			reason,
		}: { status: number; reason?: string }) => ({
			message: `HTTP ${status}${reason ? `: ${reason}` : ""}`,
			status,
			reason,
		}),
	});
	const { ResponseError, ResponseErr } = errors;

	it("computes message from fields", () => {
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
		const { DbQueryError } = defineErrors({
			DbQueryError: ({
				table,
				operation,
				backend,
			}: { table: string; operation: string; backend: string }) => ({
				message: `Database ${operation} on ${table} failed`,
				table,
				operation,
				backend,
			}),
		});

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
// Factory shape — factories available on the return object
// =============================================================================

describe("defineErrors - factory shape", () => {
	it("return object has factory properties", () => {
		const result = defineErrors({
			FooError: () => ({ message: "foo" }),
		});

		expect("FooError" in result).toBe(true);
		expect("FooErr" in result).toBe(true);
	});

	it("return object does NOT have builder methods", () => {
		const result = defineErrors({
			FooError: () => ({ message: "foo" }),
		});

		expect("withFields" in result).toBe(false);
		expect("withMessage" in result).toBe(false);
		expect("withContext" in result).toBe(false);
		expect("withCause" in result).toBe(false);
	});
});

// =============================================================================
// Mixed function shapes in one defineErrors call
// =============================================================================

describe("defineErrors - mixed function shapes", () => {
	const errors = defineErrors({
		// Zero-arg static message
		RecorderBusyError: () => ({
			message: "A recording is already in progress",
		}),

		// Computed message from fields
		ServiceError: ({
			operation,
			cause,
		}: {
			operation: "check" | "enable" | "disable";
			cause: string;
		}) => ({
			message: `Failed to ${operation}: ${cause}`,
			operation,
			cause,
		}),

		// Call-site message
		DbServiceError: ({ message }: { message: string }) => ({ message }),

		// Fields + call-site message
		OperationError: ({
			operation,
			message,
		}: { operation: string; message: string }) => ({
			message,
			operation,
		}),
	});

	it("all factories work in one defineErrors call", () => {
		const err1 = errors.RecorderBusyError();
		expect(err1.name).toBe("RecorderBusyError");
		expect(err1.message).toBe("A recording is already in progress");

		const err2 = errors.ServiceError({
			operation: "check",
			cause: "timeout",
		});
		expect(err2.name).toBe("ServiceError");
		expect(err2.message).toBe("Failed to check: timeout");
		expect(err2.operation).toBe("check");

		const err3 = errors.DbServiceError({ message: "Connection lost" });
		expect(err3.name).toBe("DbServiceError");
		expect(err3.message).toBe("Connection lost");

		const err4 = errors.OperationError({
			operation: "save",
			message: "Disk full",
		});
		expect(err4.name).toBe("OperationError");
		expect(err4.message).toBe("Disk full");
		expect(err4.operation).toBe("save");
	});

	it("all Err factories work in one defineErrors call", () => {
		const r1 = errors.RecorderBusyErr();
		expect(r1.data).toBeNull();
		expect(r1.error.name).toBe("RecorderBusyError");

		const r2 = errors.ServiceErr({
			operation: "enable",
			cause: "not found",
		});
		expect(r2.data).toBeNull();
		expect(r2.error.name).toBe("ServiceError");
	});
});

// =============================================================================
// InferError and InferErrorUnion type extraction
// =============================================================================

describe("defineErrors - type extraction", () => {
	const errors = defineErrors({
		ConnectionError: ({ cause }: { cause: string }) => ({
			message: `Failed to connect: ${cause}`,
			cause,
		}),
		ResponseError: ({
			status,
			bodyMessage,
		}: { status: number; bodyMessage?: string }) => ({
			message: bodyMessage
				? `HTTP ${status}: ${bodyMessage}`
				: `HTTP ${status} response`,
			status,
			bodyMessage,
		}),
		ParseError: ({ cause }: { cause: string }) => ({
			message: `Failed to parse response body: ${cause}`,
			cause,
		}),
	});

	it("InferError extracts a single error type", () => {
		type ConnectionError = InferError<typeof errors, "ConnectionError">;

		expectTypeOf<ConnectionError>().toEqualTypeOf<
			Readonly<{
				name: "ConnectionError";
				message: string;
				cause: string;
			}>
		>();
	});

	it("InferErrorUnion extracts union of all error types", () => {
		type HttpError = InferErrorUnion<typeof errors>;

		// The union should include all three error types
		const connErr: HttpError = errors.ConnectionError({ cause: "timeout" });
		expect(connErr.name).toBe("ConnectionError");

		const respErr: HttpError = errors.ResponseError({ status: 404 });
		expect(respErr.name).toBe("ResponseError");

		const parseErr: HttpError = errors.ParseError({ cause: "invalid json" });
		expect(parseErr.name).toBe("ParseError");
	});
});

// =============================================================================
// Functions with block bodies and complex logic
// =============================================================================

describe("defineErrors - complex constructor functions", () => {
	it("supports switch-based message computation", () => {
		const { InvalidInputError } = defineErrors({
			InvalidInputError: (input: {
				reason: "invalid_format" | "missing_field" | "type_mismatch";
				detail?: string;
			}) => {
				const messages = {
					invalid_format: `Invalid format: '${input.detail}'`,
					missing_field: "Required field is missing",
					type_mismatch: `Type mismatch: ${input.detail}`,
				} as const;
				return { message: messages[input.reason], ...input };
			},
		});

		const err1 = InvalidInputError({
			reason: "invalid_format",
			detail: "email",
		});
		expect(err1.message).toBe("Invalid format: 'email'");
		expect(err1.reason).toBe("invalid_format");

		const err2 = InvalidInputError({ reason: "missing_field" });
		expect(err2.message).toBe("Required field is missing");
	});

	it("supports spread of all input fields", () => {
		const { DataError } = defineErrors({
			DataError: (input: { table: string; operation: string }) => ({
				message: `${input.operation} failed on ${input.table}`,
				...input,
			}),
		});

		const error = DataError({ table: "users", operation: "insert" });
		expect(error.table).toBe("users");
		expect(error.operation).toBe("insert");
		expect(error.message).toBe("insert failed on users");
	});
});

// =============================================================================
// JSON Serialization
// =============================================================================

describe("defineErrors - JSON serialization", () => {
	it("flat errors round-trip through JSON perfectly", () => {
		const { ResponseError } = defineErrors({
			ResponseError: ({
				status,
				provider,
			}: { status: number; provider: string }) => ({
				message: `HTTP ${status}`,
				status,
				provider,
			}),
		});

		const error = ResponseError({ status: 401, provider: "openai" });
		const json = JSON.stringify(error);
		const parsed = JSON.parse(json);

		expect(parsed.name).toBe("ResponseError");
		expect(parsed.message).toBe("HTTP 401");
		expect(parsed.status).toBe(401);
		expect(parsed.provider).toBe("openai");
	});

	it("no nested structure to worry about", () => {
		const { DbError } = defineErrors({
			DbError: ({
				table,
				operation,
			}: { table: string; operation: string }) => ({
				message: `${operation} on ${table} failed`,
				table,
				operation,
			}),
		});

		const error = DbError({ table: "users", operation: "insert" });
		const keys = Object.keys(error).sort();
		expect(keys).toEqual(["message", "name", "operation", "table"]);
	});

	it("rest spread extracts just the extra fields", () => {
		const { ApiError } = defineErrors({
			ApiError: ({
				endpoint,
				status,
			}: { endpoint: string; status: number }) => ({
				message: `${endpoint} failed`,
				endpoint,
				status,
			}),
		});

		const error = ApiError({ endpoint: "/api", status: 500 });
		const { name: _name, message: _message, ...rest } = error;
		expect(rest).toEqual({ endpoint: "/api", status: 500 });
	});
});

// =============================================================================
// Type Safety
// =============================================================================

describe("defineErrors - type safety", () => {
	it("minimal errors have correct types", () => {
		const { NetworkError } = defineErrors({
			NetworkError: ({ message }: { message: string }) => ({ message }),
		});

		const error = NetworkError({ message: "Network error" });

		expectTypeOf(error).toEqualTypeOf<
			Readonly<{ name: "NetworkError"; message: string }>
		>();
	});

	it("errors with fields have correct types", () => {
		const { FileError } = defineErrors({
			FileError: ({
				message,
				path,
				size,
			}: { message: string; path: string; size: number }) => ({
				message,
				path,
				size,
			}),
		});

		const error = FileError({
			message: "not found",
			path: "test.txt",
			size: 1024,
		});

		expectTypeOf(error.path).toEqualTypeOf<string>();
		expectTypeOf(error.size).toEqualTypeOf<number>();
	});

	it("error objects are frozen (immutable)", () => {
		const { TestError } = defineErrors({
			TestError: ({ message }: { message: string }) => ({ message }),
		});
		const error = TestError({ message: "Original" });

		expect(Object.isFrozen(error)).toBe(true);
	});

	it("assignable to AnyTaggedError", () => {
		const { TestError } = defineErrors({
			TestError: () => ({ message: "test" }),
		});

		const error = TestError();
		const _anyError: AnyTaggedError = error;
		expect(_anyError.name).toBe("TestError");
		expect(_anyError.message).toBe("test");
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("defineErrors - edge cases", () => {
	it("handles complex nested JSON values in fields", () => {
		const { TestError } = defineErrors({
			TestError: (input: {
				nested: { deeply: { value: number } };
				array: number[];
				nullable: null;
			}) => ({
				message: `value: ${input.nested.deeply.value}`,
				...input,
			}),
		});

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
		const { TestError } = defineErrors({
			TestError: (_input: JsonObject) => ({
				message: "Test error",
			}),
		});

		const error = TestError({});
		expect(error.name).toBe("TestError");
	});

	it("cause is just another field if you want it", () => {
		const { BackendError } = defineErrors({
			BackendError: ({
				backend,
				cause,
			}: { backend: string; cause: string }) => ({
				message: `${backend} failed`,
				backend,
				cause,
			}),
		});

		const error = BackendError({ backend: "postgres", cause: "timeout" });
		expect(error.backend).toBe("postgres");
		expect(error.cause).toBe("timeout");
	});

	it("error name must end in 'Error' (type-level constraint)", () => {
		// This is enforced at the type level via `${string}Error` key constraint.
		// Can't easily test at runtime, but the constraint exists in ErrorsConfig.
		const errors = defineErrors({
			FooError: () => ({ message: "foo" }),
		});
		expect(errors.FooError().name).toBe("FooError");
	});
});

// =============================================================================
// The Console Log Test (from spec)
// =============================================================================

describe("defineErrors - the console log test", () => {
	it("produces the three example shapes from the spec", () => {
		const errors = defineErrors({
			RecorderBusyError: () => ({
				message: "A recording is already in progress",
			}),

			ResponseError: ({
				provider,
				status,
				model,
			}: { provider: string; status: number; model: string }) => ({
				message: `HTTP ${status}`,
				provider,
				status,
				model,
			}),

			DbQueryError: ({
				table,
				operation,
				backend,
			}: { table: string; operation: string; backend: string }) => ({
				message: `Database ${operation} on ${table} failed`,
				table,
				operation,
				backend,
			}),
		});

		const err1 = errors.RecorderBusyError();
		expect(err1.name).toBe("RecorderBusyError");
		expect(err1.message).toBe("A recording is already in progress");

		const err2 = errors.ResponseError({
			provider: "openai",
			status: 401,
			model: "gpt-4o",
		});
		expect(err2.name).toBe("ResponseError");
		expect(err2.message).toBe("HTTP 401");
		expect(err2.provider).toBe("openai");
		expect(err2.status).toBe(401);
		expect(err2.model).toBe("gpt-4o");

		const err3 = errors.DbQueryError({
			table: "recordings",
			operation: "insert",
			backend: "indexeddb",
		});
		expect(err3.name).toBe("DbQueryError");
		expect(err3.message).toBe("Database insert on recordings failed");
		expect(err3.table).toBe("recordings");
	});

	it("spec examples with call-site message also work", () => {
		const errors = defineErrors({
			SimpleError: ({ message }: { message: string }) => ({ message }),

			FsReadError: ({
				message,
				path,
			}: { message: string; path: string }) => ({
				message,
				path,
			}),
		});

		const err = errors.SimpleError({ message: "Something went wrong" });
		expect(err.name).toBe("SimpleError");
		expect(err.message).toBe("Something went wrong");

		const fsErr = errors.FsReadError({
			message: "Failed to read '/etc/config'",
			path: "/etc/config",
		});
		expect(fsErr.name).toBe("FsReadError");
		expect(fsErr.message).toBe("Failed to read '/etc/config'");
		expect(fsErr.path).toBe("/etc/config");
	});
});
