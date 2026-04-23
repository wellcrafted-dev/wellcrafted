import { describe, expect, test } from "bun:test";
import { Err, Ok, isErr, isOk } from "./result.js";

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

	test("Err with meaningful values works as expected", () => {
		expect(Err("string error").error).toBe("string error");
		expect(Err(new Error("native")).error).toBeInstanceOf(Error);
		expect(Err({ name: "Tagged", message: "failed" }).error.name).toBe("Tagged");
		expect(Err(0).error).toBe(0);
		expect(Err(false).error).toBe(false);
	});

	// Documents the shape's known limit. `Err(null)` produces
	// `{ data: null, error: null }` which is structurally identical to `Ok(null)`,
	// so the isErr discriminator reads it as Ok. We do NOT ban this at the type
	// level — see docs/philosophy/err-null-is-ok-null.md for why. Test pins the
	// runtime behavior so contributors can see the limit exists.
	test("Err(null) collides with Ok(null) — the shape's known limit", () => {
		const badErr = Err(null);
		const goodOk = Ok(null);
		expect(badErr).toEqual(goodOk);
		expect(isOk(badErr)).toBe(true); // the collision
		expect(isErr(badErr)).toBe(false);
	});

	// Err(undefined) is a different failure mode — the discriminator works
	// (undefined !== null, so isErr is true) but the value is semantically
	// meaningless and trips truthy checks like `if (error)` because undefined
	// is falsy. Don't call it either, but the failure is different.
	test("Err(undefined) is semantically meaningless but technically classifies as Err", () => {
		const weirdErr = Err(undefined);
		expect(isOk(weirdErr)).toBe(false);
		expect(isErr(weirdErr)).toBe(true);
		expect(weirdErr.error).toBeUndefined();
		// But falsy — trips `if (error)` checks downstream
		expect(Boolean(weirdErr.error)).toBe(false);
	});
});
