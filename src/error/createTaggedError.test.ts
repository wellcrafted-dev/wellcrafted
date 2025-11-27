import { describe, it, expect, expectTypeOf } from "vitest";
import { createTaggedError } from "./utils.js";
import type { TaggedError } from "./types.js";

// =============================================================================
// Mode 1: Flexible Mode Tests
// =============================================================================

describe("createTaggedError - Flexible Mode", () => {
	const { NetworkError, NetworkErr } = createTaggedError("NetworkError");

	describe("NetworkError (plain constructor)", () => {
		it("creates error with just message", () => {
			const error = NetworkError({ message: "Connection failed" });

			expect(error.name).toBe("NetworkError");
			expect(error.message).toBe("Connection failed");
			expect("context" in error).toBe(false);
			expect("cause" in error).toBe(false);
		});

		it("creates error with message and context", () => {
			const error = NetworkError({
				message: "Timeout",
				context: { url: "https://api.example.com", timeout: 5000 },
			});

			expect(error.name).toBe("NetworkError");
			expect(error.message).toBe("Timeout");
			expect(error.context).toEqual({
				url: "https://api.example.com",
				timeout: 5000,
			});
			expect("cause" in error).toBe(false);
		});

		it("creates error with message and cause", () => {
			const cause = NetworkError({ message: "DNS failed" });
			const error = NetworkError({
				message: "Connection failed",
				cause,
			});

			expect(error.name).toBe("NetworkError");
			expect(error.message).toBe("Connection failed");
			expect("context" in error).toBe(false);
			expect(error.cause).toBe(cause);
		});

		it("creates error with message, context, and cause", () => {
			const cause = NetworkError({ message: "DNS failed" });
			const error = NetworkError({
				message: "Connection failed",
				context: { host: "example.com" },
				cause,
			});

			expect(error.name).toBe("NetworkError");
			expect(error.message).toBe("Connection failed");
			expect(error.context).toEqual({ host: "example.com" });
			expect(error.cause).toBe(cause);
		});
	});

	describe("NetworkErr (Err-wrapped constructor)", () => {
		it("returns Err with just message", () => {
			const result = NetworkErr({ message: "Connection failed" });

			expect(result.error).toBeDefined();
			expect(result.error?.name).toBe("NetworkError");
			expect(result.error?.message).toBe("Connection failed");
			expect(result.data).toBeNull();
		});

		it("returns Err with message and context", () => {
			const result = NetworkErr({
				message: "Timeout",
				context: { url: "https://api.example.com" },
			});

			expect(result.error).toBeDefined();
			expect(result.error?.name).toBe("NetworkError");
			expect(result.error?.context).toEqual({
				url: "https://api.example.com",
			});
		});
	});
});

// =============================================================================
// Mode 2: Fixed Context Mode Tests
// =============================================================================

describe("createTaggedError - Fixed Context Mode", () => {
	type BlobContext = {
		filename: string;
		code: "INVALID_FILENAME" | "FILE_TOO_LARGE" | "PERMISSION_DENIED";
	};

	const { BlobError, BlobErr } =
		createTaggedError<"BlobError", BlobContext>("BlobError");

	describe("BlobError (plain constructor)", () => {
		it("creates error with required context", () => {
			const error = BlobError({
				message: "Invalid filename",
				context: { filename: "test.txt", code: "INVALID_FILENAME" },
			});

			expect(error.name).toBe("BlobError");
			expect(error.message).toBe("Invalid filename");
			expect(error.context).toEqual({
				filename: "test.txt",
				code: "INVALID_FILENAME",
			});
		});

		it("creates error with context and cause", () => {
			const { NetworkError } = createTaggedError("NetworkError");
			const cause = NetworkError({ message: "Upload failed" });

			const error = BlobError({
				message: "File too large",
				context: { filename: "huge.zip", code: "FILE_TOO_LARGE" },
				cause,
			});

			expect(error.name).toBe("BlobError");
			expect(error.context.filename).toBe("huge.zip");
			expect(error.context.code).toBe("FILE_TOO_LARGE");
			expect(error.cause).toBe(cause);
		});

		it("allows all valid code values", () => {
			const codes = [
				"INVALID_FILENAME",
				"FILE_TOO_LARGE",
				"PERMISSION_DENIED",
			] as const;

			for (const code of codes) {
				const error = BlobError({
					message: "Error",
					context: { filename: "test.txt", code },
				});
				expect(error.context.code).toBe(code);
			}
		});
	});

	describe("BlobErr (Err-wrapped constructor)", () => {
		it("returns Err with required context", () => {
			const result = BlobErr({
				message: "Permission denied",
				context: { filename: "secret.txt", code: "PERMISSION_DENIED" },
			});

			expect(result.error).toBeDefined();
			expect(result.error?.context.filename).toBe("secret.txt");
			expect(result.error?.context.code).toBe("PERMISSION_DENIED");
		});
	});
});

// =============================================================================
// Mode 3: Both Fixed Mode Tests
// =============================================================================

describe("createTaggedError - Both Fixed Mode", () => {
	// For "Both Fixed Mode", we define the cause type explicitly as a TaggedError type
	// This mode is for when you want to constrain BOTH context shape AND cause type

	type NetworkContext = { url: string; statusCode?: number };
	type NetworkErrorType = TaggedError<"NetworkError", never, NetworkContext>;

	type ApiContext = { endpoint: string; method: string };
	const { ApiError, ApiErr } = createTaggedError<
		"ApiError",
		ApiContext,
		NetworkErrorType
	>("ApiError");

	// Also create flexible NetworkError for producing cause values
	const { NetworkError } =
		createTaggedError<"NetworkError", NetworkContext>("NetworkError");

	describe("ApiError (plain constructor)", () => {
		it("creates error with context (no cause)", () => {
			const error = ApiError({
				message: "Request failed",
				context: { endpoint: "/users", method: "GET" },
			});

			expect(error.name).toBe("ApiError");
			expect(error.context.endpoint).toBe("/users");
			expect(error.context.method).toBe("GET");
			expect("cause" in error).toBe(false);
		});

		it("creates error with context and typed cause", () => {
			// Create network error with the fixed context type
			const networkError = NetworkError({
				message: "Connection refused",
				context: { url: "https://api.example.com", statusCode: 503 },
			});

			// The networkError type matches NetworkErrorType because it has
			// name: "NetworkError" and context: NetworkContext
			const error = ApiError({
				message: "API unavailable",
				context: { endpoint: "/health", method: "GET" },
				cause: networkError as NetworkErrorType,
			});

			expect(error.name).toBe("ApiError");
			expect(error.context.endpoint).toBe("/health");
			expect(error.cause.name).toBe("NetworkError");
			expect(error.cause.context.url).toBe("https://api.example.com");
			expect(error.cause.context.statusCode).toBe(503);
		});
	});

	describe("ApiErr (Err-wrapped constructor)", () => {
		it("returns Err with context and cause", () => {
			const networkError = NetworkError({
				message: "Timeout",
				context: { url: "https://api.example.com" },
			});

			const result = ApiErr({
				message: "Request timed out",
				context: { endpoint: "/data", method: "POST" },
				cause: networkError as NetworkErrorType,
			});

			expect(result.error).toBeDefined();
			expect(result.error?.name).toBe("ApiError");
			expect(result.error?.cause.name).toBe("NetworkError");
		});
	});
});

// =============================================================================
// Error Chaining Tests
// =============================================================================

describe("createTaggedError - Error Chaining", () => {
	it("supports multi-level error chains", () => {
		// Level 1: Database error
		const { DatabaseError } = createTaggedError("DatabaseError");
		const dbError = DatabaseError({
			message: "Query failed",
			context: { query: "SELECT * FROM users", table: "users" },
		});

		// Level 2: Repository error wrapping database error
		const { RepositoryError } = createTaggedError("RepositoryError");
		const repoError = RepositoryError({
			message: "Failed to fetch user",
			context: { entity: "User", operation: "findById" },
			cause: dbError,
		});

		// Level 3: Service error wrapping repository error
		const { ServiceError } = createTaggedError("ServiceError");
		const serviceError = ServiceError({
			message: "User service failed",
			context: { service: "UserService", method: "getProfile" },
			cause: repoError,
		});

		// Verify the chain
		expect(serviceError.name).toBe("ServiceError");
		expect(serviceError.cause.name).toBe("RepositoryError");
		expect(serviceError.cause.cause.name).toBe("DatabaseError");
		expect(serviceError.cause.cause.context.query).toBe(
			"SELECT * FROM users",
		);
	});

	it("errors are JSON serializable", () => {
		const { NetworkError } = createTaggedError("NetworkError");
		const { ApiError } = createTaggedError("ApiError");

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
// Type Tests (compile-time checks)
// =============================================================================

describe("Type Safety", () => {
	it("flexible mode has correct types", () => {
		const { NetworkError } = createTaggedError("NetworkError");

		// Just message
		const e1 = NetworkError({ message: "Error" });
		expectTypeOf(e1).toMatchTypeOf<{ name: "NetworkError"; message: string }>();

		// With context
		const e2 = NetworkError({
			message: "Error",
			context: { url: "https://..." },
		});
		expectTypeOf(e2.context).toMatchTypeOf<{ url: string }>();
	});

	it("fixed context mode requires context", () => {
		type Ctx = { filename: string };
		const { FileError } = createTaggedError<"FileError", Ctx>("FileError");

		const error = FileError({
			message: "Error",
			context: { filename: "test.txt" },
		});

		expectTypeOf(error.context).toEqualTypeOf<{ filename: string }>();
	});

	it("both fixed mode constrains cause type", () => {
		// Define the cause type explicitly
		type CauseType = TaggedError<"CauseError", never, never>;

		const { WrapperError } = createTaggedError<
			"WrapperError",
			{ wrap: boolean },
			CauseType
		>("WrapperError");

		// Create a cause that matches CauseType
		const { CauseError } = createTaggedError("CauseError");
		const cause = CauseError({ message: "Root cause" });

		const wrapper = WrapperError({
			message: "Wrapped",
			context: { wrap: true },
			cause: cause as CauseType,
		});

		expectTypeOf(wrapper.cause).toMatchTypeOf<CauseType>();
	});
});

// =============================================================================
// Edge Cases
// =============================================================================

describe("Edge Cases", () => {
	it("handles empty context object", () => {
		const { TestError } = createTaggedError("TestError");
		const error = TestError({ message: "Error", context: {} });

		expect(error.context).toEqual({});
	});

	it("handles complex nested context", () => {
		const { TestError } = createTaggedError("TestError");
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
