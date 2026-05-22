import { describe, expect, expectTypeOf, it } from "bun:test";
import { type JsonValue, parseJson } from "./json.js";
import { expectErr, expectOk } from "./testing.js";

describe("parseJson", () => {
	// =============================================================================
	// Success: every JSON value kind round-trips
	// =============================================================================

	it("parses an object", () => {
		expect(expectOk(parseJson('{"count":1,"ok":true}'))).toEqual({
			count: 1,
			ok: true,
		});
	});

	it("parses an array", () => {
		expect(expectOk(parseJson('[1,"two",false,null]'))).toEqual([
			1,
			"two",
			false,
			null,
		]);
	});

	it("parses primitives", () => {
		expect(expectOk(parseJson('"hello"'))).toBe("hello");
		expect(expectOk(parseJson("42"))).toBe(42);
		expect(expectOk(parseJson("true"))).toBe(true);
		expect(expectOk(parseJson("null"))).toBeNull();
	});

	// =============================================================================
	// Failure: malformed input produces a tagged JsonParseError
	// =============================================================================

	it("returns Err for malformed input", () => {
		const error = expectErr(parseJson("{ not json"));
		expect(error.name).toBe("JsonParseError");
		expect(error.message).toStartWith("Failed to parse JSON: ");
	});

	it("returns Err for an empty string", () => {
		expect(expectErr(parseJson("")).name).toBe("JsonParseError");
	});

	it("preserves the underlying SyntaxError as cause", () => {
		expect(expectErr(parseJson("{")).cause).toBeInstanceOf(SyntaxError);
	});

	// =============================================================================
	// Types: success value is JsonValue, never `any`
	// =============================================================================

	it("types the success value as JsonValue", () => {
		expectTypeOf(expectOk(parseJson("{}"))).toEqualTypeOf<JsonValue>();
	});
});
