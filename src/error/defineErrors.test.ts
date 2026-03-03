import { describe, it, expect, expectTypeOf } from "bun:test";
import { defineErrors } from "./defineErrors.js";
import { extractErrorMessage } from "./extractErrorMessage.js";
import type {
	AnyTaggedError,
	InferError,
	InferErrors,
	JsonObject,
} from "./types.js";

// =============================================================================
// Basic factories — message at call site equivalent
// =============================================================================

describe("defineErrors - call-site message", () => {
	const SimpleError = defineErrors({
		Simple: ({ message }: { message: string }) => ({ message }),
	});

	it("creates error with name and call-site message", () => {
		const result = SimpleError.Simple({ message: "Something went wrong" });

		expect(result.error.name).toBe("Simple");
		expect(result.error.message).toBe("Something went wrong");
		expect(result.data).toBeNull();
	});

	it("creates error with no extra properties", () => {
		const result = SimpleError.Simple({ message: "test" });

		const { name: _name, message: _message, ...rest } = result.error;
		expect(Object.keys(rest)).toHaveLength(0);
	});

	it("minimal error has correct type (name and message only)", () => {
		const result = SimpleError.Simple({ message: "test" });

		expectTypeOf(result.error).toEqualTypeOf<
			Readonly<{ name: "Simple"; message: string }>
		>();
	});
});

// =============================================================================
// Static message — zero-arg factory
// =============================================================================

describe("defineErrors - static message", () => {
	const RecordingError = defineErrors({
		Busy: () => ({
			message: "A recording is already in progress",
		}),
	});

	it("uses sealed message when called with no args", () => {
		const result = RecordingError.Busy();

		expect(result.error.name).toBe("Busy");
		expect(result.error.message).toBe("A recording is already in progress");
	});

	it("message is always the constructor output", () => {
		const result = RecordingError.Busy();
		expect(result.error.message).toBe("A recording is already in progress");
	});

	it("factory returns Err with correct shape", () => {
		const result = RecordingError.Busy();

		expect(result.data).toBeNull();
		expect(result.error.name).toBe("Busy");
		expect(result.error.message).toBe("A recording is already in progress");
	});
});

// =============================================================================
// Fields + call-site message
// =============================================================================

describe("defineErrors - fields + call-site message", () => {
	const FsError = defineErrors({
		Read: ({ message, path }: { message: string; path: string }) => ({
			message,
			path,
		}),
	});

	it("creates error with message and fields", () => {
		const result = FsError.Read({
			message: "Failed to read config",
			path: "/etc/config",
		});

		expect(result.error.name).toBe("Read");
		expect(result.error.message).toBe("Failed to read config");
		expect(result.error.path).toBe("/etc/config");
	});

	it("fields are typed correctly in output", () => {
		const result = FsError.Read({ message: "test", path: "/tmp/test" });

		expectTypeOf(result.error.path).toEqualTypeOf<string>();
	});

	it("wraps in Err result with fields accessible on .error", () => {
		const result = FsError.Read({
			message: "Failed to read",
			path: "/etc/config",
		});

		expect(result.data).toBeNull();
		expect(result.error.name).toBe("Read");
		expect(result.error.path).toBe("/etc/config");
	});
});

// =============================================================================
// Computed message from fields
// =============================================================================

describe("defineErrors - computed message from fields", () => {
	const HttpError = defineErrors({
		Response: ({ status, reason }: { status: number; reason?: string }) => ({
			message: `HTTP ${status}${reason ? `: ${reason}` : ""}`,
			status,
			reason,
		}),
	});

	it("computes message from fields", () => {
		const result = HttpError.Response({ status: 404 });

		expect(result.error.name).toBe("Response");
		expect(result.error.message).toBe("HTTP 404");
		expect(result.error.status).toBe(404);
	});

	it("template receives fields including optional ones", () => {
		const result = HttpError.Response({
			status: 500,
			reason: "Internal error",
		});

		expect(result.error.message).toBe("HTTP 500: Internal error");
		expect(result.error.status).toBe(500);
		expect(result.error.reason).toBe("Internal error");
	});

	it("fields are typed correctly in output", () => {
		const result = HttpError.Response({ status: 200 });

		expectTypeOf(result.error.status).toEqualTypeOf<number>();
		expectTypeOf(result.error.reason).toEqualTypeOf<string | undefined>();
	});

	it("wraps in Err result", () => {
		const result = HttpError.Response({ status: 503 });

		expect(result.data).toBeNull();
		expect(result.error.status).toBe(503);
	});

	it("multi-field error with complex types", () => {
		const DbError = defineErrors({
			Query: ({
				table,
				operation,
				backend,
			}: {
				table: string;
				operation: string;
				backend: string;
			}) => ({
				message: `Database ${operation} on ${table} failed`,
				table,
				operation,
				backend,
			}),
		});

		const result = DbError.Query({
			table: "recordings",
			operation: "insert",
			backend: "indexeddb",
		});

		expect(result.error.name).toBe("Query");
		expect(result.error.message).toBe("Database insert on recordings failed");
		expect(result.error.table).toBe("recordings");
		expect(result.error.operation).toBe("insert");
		expect(result.error.backend).toBe("indexeddb");
	});
});

// =============================================================================
// Factory shape — factories available on the return object
// =============================================================================

describe("defineErrors - factory shape", () => {
	it("return object has variant key", () => {
		const result = defineErrors({
			Foo: () => ({ message: "foo" }),
		});

		expect("Foo" in result).toBe(true);
	});

	it("return object does NOT have Error-suffixed or Err-suffixed keys", () => {
		const result = defineErrors({
			Foo: () => ({ message: "foo" }),
		});

		expect("FooErr" in result).toBe(false);
		expect("FooError" in result).toBe(false);
	});

	it("return object does NOT have builder methods", () => {
		const result = defineErrors({
			Foo: () => ({ message: "foo" }),
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
	const RecordingError = defineErrors({
		// Zero-arg static message
		Busy: () => ({
			message: "A recording is already in progress",
		}),

		// Computed message from fields
		Service: ({
			operation,
			cause,
		}: {
			operation: "check" | "enable" | "disable";
			cause: unknown;
		}) => ({
			message: `Failed to ${operation}: ${extractErrorMessage(cause)}`,
			operation,
			cause,
		}),

		// Call-site message
		Unknown: ({ message }: { message: string }) => ({ message }),

		// Fields + call-site message
		Operation: ({
			operation,
			message,
		}: {
			operation: string;
			message: string;
		}) => ({
			message,
			operation,
		}),
	});

	it("all factories work in one defineErrors call", () => {
		const r1 = RecordingError.Busy();
		expect(r1.error.name).toBe("Busy");
		expect(r1.error.message).toBe("A recording is already in progress");

		const r2 = RecordingError.Service({
			operation: "check",
			cause: "timeout",
		});
		expect(r2.error.name).toBe("Service");
		expect(r2.error.message).toBe("Failed to check: timeout");
		expect(r2.error.operation).toBe("check");

		const r3 = RecordingError.Unknown({ message: "Connection lost" });
		expect(r3.error.name).toBe("Unknown");
		expect(r3.error.message).toBe("Connection lost");

		const r4 = RecordingError.Operation({
			operation: "save",
			message: "Disk full",
		});
		expect(r4.error.name).toBe("Operation");
		expect(r4.error.message).toBe("Disk full");
		expect(r4.error.operation).toBe("save");
	});

	it("all factories return Err directly", () => {
		const r1 = RecordingError.Busy();
		expect(r1.data).toBeNull();
		expect(r1.error.name).toBe("Busy");

		const r2 = RecordingError.Service({
			operation: "enable",
			cause: "not found",
		});
		expect(r2.data).toBeNull();
		expect(r2.error.name).toBe("Service");
	});
});

// =============================================================================
// InferError and InferErrors type extraction
// =============================================================================

describe("defineErrors - type extraction", () => {
	const HttpError = defineErrors({
		Connection: ({ cause }: { cause: unknown }) => ({
			message: `Failed to connect: ${extractErrorMessage(cause)}`,
			cause,
		}),
		Response: ({
			status,
			bodyMessage,
		}: {
			status: number;
			bodyMessage?: string;
		}) => ({
			message: bodyMessage
				? `HTTP ${status}: ${bodyMessage}`
				: `HTTP ${status} response`,
			status,
			bodyMessage,
		}),
		Parse: ({ cause }: { cause: unknown }) => ({
			message: `Failed to parse response body: ${extractErrorMessage(cause)}`,
			cause,
		}),
	});

	it("InferError extracts a single error type from a factory", () => {
		type ConnectionError = InferError<typeof HttpError.Connection>;

		expectTypeOf<ConnectionError>().toEqualTypeOf<
			Readonly<{
				name: "Connection";
				message: string;
				cause: unknown;
			}>
		>();
	});

	it("InferErrors extracts union of all error types", () => {
		type HttpErrorUnion = InferErrors<typeof HttpError>;

		const connResult = HttpError.Connection({ cause: "timeout" });
		const connErr: HttpErrorUnion = connResult.error;
		expect(connErr.name).toBe("Connection");

		const respResult = HttpError.Response({ status: 404 });
		const respErr: HttpErrorUnion = respResult.error;
		expect(respErr.name).toBe("Response");

		const parseResult = HttpError.Parse({ cause: "invalid json" });
		const parseErr: HttpErrorUnion = parseResult.error;
		expect(parseErr.name).toBe("Parse");
	});
});

// =============================================================================
// Functions with block bodies and complex logic
// =============================================================================

describe("defineErrors - complex constructor functions", () => {
	it("supports switch-based message computation", () => {
		const InputError = defineErrors({
			Invalid: (input: {
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

		const r1 = InputError.Invalid({
			reason: "invalid_format",
			detail: "email",
		});
		expect(r1.error.message).toBe("Invalid format: 'email'");
		expect(r1.error.reason).toBe("invalid_format");

		const r2 = InputError.Invalid({ reason: "missing_field" });
		expect(r2.error.message).toBe("Required field is missing");
	});

	it("supports spread of all input fields", () => {
		const DataError = defineErrors({
			Query: (input: { table: string; operation: string }) => ({
				message: `${input.operation} failed on ${input.table}`,
				...input,
			}),
		});

		const result = DataError.Query({ table: "users", operation: "insert" });
		expect(result.error.table).toBe("users");
		expect(result.error.operation).toBe("insert");
		expect(result.error.message).toBe("insert failed on users");
	});
});

// =============================================================================
// JSON Serialization
// =============================================================================

describe("defineErrors - JSON serialization", () => {
	it("flat errors round-trip through JSON perfectly", () => {
		const HttpError = defineErrors({
			Response: ({
				status,
				provider,
			}: {
				status: number;
				provider: string;
			}) => ({
				message: `HTTP ${status}`,
				status,
				provider,
			}),
		});

		const result = HttpError.Response({ status: 401, provider: "openai" });
		const json = JSON.stringify(result.error);
		const parsed = JSON.parse(json);

		expect(parsed.name).toBe("Response");
		expect(parsed.message).toBe("HTTP 401");
		expect(parsed.status).toBe(401);
		expect(parsed.provider).toBe("openai");
	});

	it("no nested structure to worry about", () => {
		const DbError = defineErrors({
			Query: ({ table, operation }: { table: string; operation: string }) => ({
				message: `${operation} on ${table} failed`,
				table,
				operation,
			}),
		});

		const result = DbError.Query({ table: "users", operation: "insert" });
		const keys = Object.keys(result.error).sort();
		expect(keys).toEqual(["message", "name", "operation", "table"]);
	});

	it("rest spread extracts just the extra fields", () => {
		const ApiError = defineErrors({
			Request: ({
				endpoint,
				status,
			}: {
				endpoint: string;
				status: number;
			}) => ({
				message: `${endpoint} failed`,
				endpoint,
				status,
			}),
		});

		const result = ApiError.Request({ endpoint: "/api", status: 500 });
		const { name: _name, message: _message, ...rest } = result.error;
		expect(rest).toEqual({ endpoint: "/api", status: 500 });
	});
});

// =============================================================================
// Type Safety
// =============================================================================

describe("defineErrors - type safety", () => {
	it("minimal errors have correct types", () => {
		const NetworkError = defineErrors({
			Timeout: ({ message }: { message: string }) => ({ message }),
		});

		const result = NetworkError.Timeout({ message: "Network error" });

		expectTypeOf(result.error).toEqualTypeOf<
			Readonly<{ name: "Timeout"; message: string }>
		>();
	});

	it("errors with fields have correct types", () => {
		const FileError = defineErrors({
			NotFound: ({
				message,
				path,
				size,
			}: {
				message: string;
				path: string;
				size: number;
			}) => ({
				message,
				path,
				size,
			}),
		});

		const result = FileError.NotFound({
			message: "not found",
			path: "test.txt",
			size: 1024,
		});

		expectTypeOf(result.error.path).toEqualTypeOf<string>();
		expectTypeOf(result.error.size).toEqualTypeOf<number>();
	});

	it("inner error objects are frozen (immutable)", () => {
		const TestError = defineErrors({
			Generic: ({ message }: { message: string }) => ({ message }),
		});
		const result = TestError.Generic({ message: "Original" });

		expect(Object.isFrozen(result.error)).toBe(true);
	});

	it("assignable to AnyTaggedError", () => {
		const TestError = defineErrors({
			Generic: () => ({ message: "test" }),
		});

		const result = TestError.Generic();
		const _anyError: AnyTaggedError = result.error;
		expect(_anyError.name).toBe("Generic");
		expect(_anyError.message).toBe("test");
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("defineErrors - edge cases", () => {
	it("handles complex nested JSON values in fields", () => {
		const TestError = defineErrors({
			Complex: (input: {
				nested: { deeply: { value: number } };
				array: number[];
				nullable: null;
			}) => ({
				message: `value: ${input.nested.deeply.value}`,
				...input,
			}),
		});

		const result = TestError.Complex({
			nested: { deeply: { value: 123 } },
			array: [1, 2, 3],
			nullable: null,
		});

		expect(result.error.nested.deeply.value).toBe(123);
		expect(result.error.array).toEqual([1, 2, 3]);
		expect(result.error.nullable).toBeNull();
	});

	it("handles empty fields object", () => {
		const TestError = defineErrors({
			Empty: (_input: JsonObject) => ({
				message: "Test error",
			}),
		});

		const result = TestError.Empty({});
		expect(result.error.name).toBe("Empty");
	});

	it("cause is just another field if you want it", () => {
		const BackendError = defineErrors({
			Failure: ({ backend, cause }: { backend: string; cause: unknown }) => ({
				message: `${backend} failed: ${extractErrorMessage(cause)}`,
				backend,
				cause,
			}),
		});

		const result = BackendError.Failure({
			backend: "postgres",
			cause: "timeout",
		});
		expect(result.error.backend).toBe("postgres");
		expect(result.error.message).toBe("postgres failed: timeout");
		expect(result.error.cause).toBe("timeout");
	});
});

// =============================================================================
// The Console Log Test (from spec)
// =============================================================================

describe("defineErrors - the console log test", () => {
	it("produces the three example shapes from the spec", () => {
		const RecordingError = defineErrors({
			Busy: () => ({
				message: "A recording is already in progress",
			}),

			Service: ({
				operation,
				cause,
			}: {
				operation: string;
				cause: unknown;
			}) => ({
				message: `Failed to ${operation}: ${extractErrorMessage(cause)}`,
				operation,
				cause,
			}),
		});

		const HttpError = defineErrors({
			Response: ({
				provider,
				status,
				model,
			}: {
				provider: string;
				status: number;
				model: string;
			}) => ({
				message: `HTTP ${status}`,
				provider,
				status,
				model,
			}),
		});

		const DbError = defineErrors({
			Query: ({
				table,
				operation,
				backend,
			}: {
				table: string;
				operation: string;
				backend: string;
			}) => ({
				message: `Database ${operation} on ${table} failed`,
				table,
				operation,
				backend,
			}),
		});

		const r1 = RecordingError.Busy();
		expect(r1.error.name).toBe("Busy");
		expect(r1.error.message).toBe("A recording is already in progress");

		const r2 = HttpError.Response({
			provider: "openai",
			status: 401,
			model: "gpt-4o",
		});
		expect(r2.error.name).toBe("Response");
		expect(r2.error.message).toBe("HTTP 401");
		expect(r2.error.provider).toBe("openai");
		expect(r2.error.status).toBe(401);
		expect(r2.error.model).toBe("gpt-4o");

		const r3 = DbError.Query({
			table: "recordings",
			operation: "insert",
			backend: "indexeddb",
		});
		expect(r3.error.name).toBe("Query");
		expect(r3.error.message).toBe("Database insert on recordings failed");
		expect(r3.error.table).toBe("recordings");
	});

	it("spec examples with call-site message also work", () => {
		const AppError = defineErrors({
			Simple: ({ message }: { message: string }) => ({ message }),

			FsRead: ({ message, path }: { message: string; path: string }) => ({
				message,
				path,
			}),
		});

		const r1 = AppError.Simple({ message: "Something went wrong" });
		expect(r1.error.name).toBe("Simple");
		expect(r1.error.message).toBe("Something went wrong");

		const r2 = AppError.FsRead({
			message: "Failed to read '/etc/config'",
			path: "/etc/config",
		});
		expect(r2.error.name).toBe("FsRead");
		expect(r2.error.message).toBe("Failed to read '/etc/config'");
		expect(r2.error.path).toBe("/etc/config");
	});
});
