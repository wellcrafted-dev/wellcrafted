import { describe, expect, expectTypeOf, it } from "bun:test";
import { once } from "./function.js";

describe("once", () => {
	// =============================================================================
	// Runs at most once
	// =============================================================================

	it("runs the wrapped fn only on the first call", () => {
		let calls = 0;
		const wrapped = once(() => {
			calls++;
		});
		wrapped();
		wrapped();
		wrapped();
		expect(calls).toBe(1);
	});

	// =============================================================================
	// Caches the first result
	// =============================================================================

	it("returns the first result on every later call", () => {
		let n = 0;
		const wrapped = once(() => ++n);
		expect(wrapped()).toBe(1);
		expect(wrapped()).toBe(1);
		expect(n).toBe(1);
	});

	it("caches the same object reference across calls", () => {
		const wrapped = once(() => ({ id: Math.random() }));
		expect(wrapped()).toBe(wrapped());
	});

	// =============================================================================
	// Later arguments are ignored
	// =============================================================================

	it("passes the first call args and ignores later ones", () => {
		const seen: number[] = [];
		const wrapped = once((x: number) => {
			seen.push(x);
			return x;
		});
		expect(wrapped(1)).toBe(1);
		expect(wrapped(2)).toBe(1);
		expect(seen).toEqual([1]);
	});

	// =============================================================================
	// Types: the wrapper mirrors the wrapped function's signature
	// =============================================================================

	it("preserves the wrapped function's parameter and return types", () => {
		const wrapped = once((a: number, b: string) => `${a}${b}`);
		expectTypeOf(wrapped).toEqualTypeOf<(a: number, b: string) => string>();
	});
});
