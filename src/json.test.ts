import { describe, expect, expectTypeOf, it } from "bun:test";
import { type JsonValue, parseJson } from "./json.js";

describe("parseJson", () => {
	// =============================================================================
	// Success: every JSON value kind round-trips
	// =============================================================================

	it("parses an object", () => {
		const { data, error } = parseJson('{"count":1,"ok":true}');
		expect(error).toBeNull();
		expect(data).toEqual({ count: 1, ok: true });
	});

	it("parses an array", () => {
		const { data, error } = parseJson('[1,"two",false,null]');
		expect(error).toBeNull();
		expect(data).toEqual([1, "two", false, null]);
	});

	it("parses primitives", () => {
		expect(parseJson('"hello"').data).toBe("hello");
		expect(parseJson("42").data).toBe(42);
		expect(parseJson("true").data).toBe(true);
		expect(parseJson("null").data).toBeNull();
	});

	// =============================================================================
	// Failure: malformed input produces a tagged JsonParseError
	// =============================================================================

	it("returns Err for malformed input", () => {
		const { data, error } = parseJson("{ not json");
		expect(data).toBeNull();
		expect(error).not.toBeNull();
		expect(error?.name).toBe("JsonParseError");
		expect(error?.message).toStartWith("Failed to parse JSON: ");
	});

	it("returns Err for an empty string", () => {
		expect(parseJson("").error?.name).toBe("JsonParseError");
	});

	it("preserves the underlying SyntaxError as cause", () => {
		const { error } = parseJson("{");
		expect(error?.cause).toBeInstanceOf(SyntaxError);
	});

	// =============================================================================
	// Types: success value is JsonValue, never `any`
	// =============================================================================

	it("types the success value as JsonValue", () => {
		const { data, error } = parseJson("{}");
		if (!error) {
			expectTypeOf(data).toEqualTypeOf<JsonValue>();
		}
	});
});
