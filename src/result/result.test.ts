import { describe, expect, test } from "bun:test";
import { Err, Ok, isErr, isOk } from "./result.js";

describe("Err constructor — NonNullable constraint", () => {
	test("Err(null) is a compile-time error", () => {
		// @ts-expect-error — null is not assignable to NonNullable<unknown>
		Err(null);
	});

	test("Err(undefined) is a compile-time error", () => {
		// @ts-expect-error — undefined is not assignable to NonNullable<unknown>
		Err(undefined);
	});

	test("Err with meaningful values is fine", () => {
		const r1 = Err("string error");
		expect(r1.error).toBe("string error");
		expect(r1.data).toBeNull();

		const r2 = Err(new Error("native error"));
		expect(r2.error).toBeInstanceOf(Error);

		const r3 = Err({ name: "Tagged", message: "failed" });
		expect(r3.error.name).toBe("Tagged");

		const r4 = Err(0);
		expect(r4.error).toBe(0);

		const r5 = Err(false);
		expect(r5.error).toBe(false);
	});
});

describe("Ok / Err structural invariants", () => {
	test("Ok(null) is valid — 'not found is not an error' is a common pattern", () => {
		const result = Ok(null);
		expect(isOk(result)).toBe(true);
		expect(isErr(result)).toBe(false);
		expect(result.data).toBeNull();
		expect(result.error).toBeNull();
	});

	test("Ok(undefined) is valid — void-success pattern", () => {
		const result = Ok(undefined);
		expect(isOk(result)).toBe(true);
		expect(isErr(result)).toBe(false);
	});

	test("always discriminate by the error side", () => {
		const ok = Ok(null);
		const err = Err("boom");

		// Don't: checking data === null matches Ok<null> AND Err<E>
		expect(ok.data === null).toBe(true);
		expect(err.data === null).toBe(true); // false positive

		// Do: error !== null / isErr uniquely identifies Err
		expect(ok.error === null).toBe(true);
		expect(err.error === null).toBe(false);
		expect(isErr(ok)).toBe(false);
		expect(isErr(err)).toBe(true);
	});
});
