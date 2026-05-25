import { describe, it, expect, expectTypeOf } from "bun:test";
import { defineHttpErrors } from "./defineHttpErrors.js";
import type { InferHttpError, InferHttpErrors } from "./defineHttpErrors.js";
import type { Err } from "../result/result.js";

// =============================================================================
// Basic factories
// =============================================================================

describe("defineHttpErrors - basic factories", () => {
	const AssetError = defineHttpErrors({
		MissingFile: [400, () => ({ message: "Missing file" })],
		NotFound: [404, () => ({ message: "Asset not found" })],
	});

	it("stamps name on the error", () => {
		const result = AssetError.MissingFile();
		expect(result.error.name).toBe("MissingFile");
	});

	it("preserves message", () => {
		const result = AssetError.MissingFile();
		expect(result.error.message).toBe("Missing file");
	});

	it("wraps in Err shape", () => {
		const result = AssetError.MissingFile();
		expect(result.data).toBeNull();
	});

	it("attaches literal status to factory", () => {
		expect(AssetError.MissingFile.status).toBe(400);
		expect(AssetError.NotFound.status).toBe(404);
	});

	it("status is not in the error body", () => {
		const result = AssetError.MissingFile();
		expect("status" in result.error).toBe(false);
	});
});

// =============================================================================
// Factories with fields
// =============================================================================

describe("defineHttpErrors - factories with fields", () => {
	const AssetError = defineHttpErrors({
		FileTooLarge: [413, ({ size }: { size: number }) => ({
			message: `File too large: ${size}`,
			size,
		})],
		FileTypeNotAllowed: [415, ({ contentType }: { contentType: string }) => ({
			message: `File type not allowed: ${contentType}`,
			contentType,
		})],
	});

	it("forwards fields to the error body", () => {
		const result = AssetError.FileTooLarge({ size: 1024 });
		expect(result.error.size).toBe(1024);
		expect(result.error.message).toBe("File too large: 1024");
	});

	it("status is correct literal on factory with args", () => {
		expect(AssetError.FileTooLarge.status).toBe(413);
		expect(AssetError.FileTypeNotAllowed.status).toBe(415);
	});

	it("status is not in the error body even when fields are present", () => {
		const result = AssetError.FileTooLarge({ size: 2048 });
		expect("status" in result.error).toBe(false);
	});
});

// =============================================================================
// Error body is frozen
// =============================================================================

describe("defineHttpErrors - immutability", () => {
	it("error body is frozen", () => {
		const E = defineHttpErrors({
			Fail: [500, () => ({ message: "fail" })],
		});
		const result = E.Fail();
		expect(Object.isFrozen(result.error)).toBe(true);
	});
});

// =============================================================================
// Types
// =============================================================================

describe("defineHttpErrors - types", () => {
	const AssetError = defineHttpErrors({
		MissingFile: [400, () => ({ message: "Missing file" })],
		FileTooLarge: [413, ({ size }: { size: number }) => ({
			message: `File too large: ${size}`,
			size,
		})],
	});

	it("factory return is Err with correct shape", () => {
		const result = AssetError.MissingFile();
		expectTypeOf(result).toEqualTypeOf<
			Err<Readonly<{ name: "MissingFile"; message: string }>>
		>();
	});

	it("factory with fields has correct shape", () => {
		const result = AssetError.FileTooLarge({ size: 1 });
		expectTypeOf(result).toEqualTypeOf<
			Err<Readonly<{ name: "FileTooLarge"; message: string; size: number }>>
		>();
	});

	it("status is a literal type on the factory", () => {
		expectTypeOf(AssetError.MissingFile.status).toEqualTypeOf<400>();
		expectTypeOf(AssetError.FileTooLarge.status).toEqualTypeOf<413>();
	});

	it("InferHttpError extracts single error type", () => {
		type MissingFileError = InferHttpError<typeof AssetError.MissingFile>;
		expectTypeOf<MissingFileError>().toEqualTypeOf<
			Readonly<{ name: "MissingFile"; message: string }>
		>();
	});

	it("InferHttpErrors extracts union of all error types", () => {
		type AnyAssetError = InferHttpErrors<typeof AssetError>;
		const result = AssetError.MissingFile();
		const err: AnyAssetError = result.error;
		expect(err.name).toBe("MissingFile");
	});
});

// =============================================================================
// Reserved key — `name`
// =============================================================================

describe("defineHttpErrors - reserved keys", () => {
	it("forbids `name` in the variant body", () => {
		defineHttpErrors({
			// @ts-expect-error — 'name' is reserved
			Bad: [400, () => ({ message: "x", name: "overwritten" as const })],
		});
	});
});

// =============================================================================
// Multiple variants
// =============================================================================

describe("defineHttpErrors - multiple variants", () => {
	const ApiError = defineHttpErrors({
		Unauthorized:    [401, () => ({ message: "Unauthorized" })],
		Forbidden:       [403, () => ({ message: "Forbidden" })],
		NotFound:        [404, () => ({ message: "Not found" })],
		TooManyRequests: [429, () => ({ message: "Too many requests" })],
		Internal:        [500, () => ({ message: "Internal server error" })],
	});

	it("each variant has its own status literal", () => {
		expect(ApiError.Unauthorized.status).toBe(401);
		expect(ApiError.Forbidden.status).toBe(403);
		expect(ApiError.NotFound.status).toBe(404);
		expect(ApiError.TooManyRequests.status).toBe(429);
		expect(ApiError.Internal.status).toBe(500);
	});

	it("each variant stamps the correct name", () => {
		expect(ApiError.Unauthorized().error.name).toBe("Unauthorized");
		expect(ApiError.Forbidden().error.name).toBe("Forbidden");
		expect(ApiError.NotFound().error.name).toBe("NotFound");
	});

	it("status is not in any error body", () => {
		for (const key of ["Unauthorized", "Forbidden", "NotFound", "TooManyRequests", "Internal"] as const) {
			expect("status" in ApiError[key]().error).toBe(false);
		}
	});
});
