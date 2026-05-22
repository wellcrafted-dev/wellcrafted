import { describe, expect, expectTypeOf, it } from "bun:test";
import { Err, Ok } from "./result/index.js";
import { expectErr, expectOk } from "./testing.js";

describe("expectOk", () => {
	it("returns data when the Result is Ok", () => {
		expect(expectOk(Ok(42))).toBe(42);
	});

	it("throws when the Result is Err", () => {
		expect(() => expectOk(Err("boom"))).toThrow(
			"Expected Ok, but got Err: boom",
		);
	});

	it("narrows the return value to the success type", () => {
		expectTypeOf(expectOk(Ok("hello"))).toEqualTypeOf<string>();
	});
});

describe("expectErr", () => {
	it("returns the error when the Result is Err", () => {
		expect(expectErr(Err("boom"))).toBe("boom");
	});

	it("throws when the Result is Ok", () => {
		expect(() => expectErr(Ok(42))).toThrow("Expected Err, but got Ok");
	});

	it("narrows the return value to the error type", () => {
		expectTypeOf(expectErr(Err({ name: "X" as const }))).toEqualTypeOf<{
			name: "X";
		}>();
	});
});
