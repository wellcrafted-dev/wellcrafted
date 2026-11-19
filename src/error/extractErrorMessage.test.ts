import { describe, expect, it } from "bun:test";
import { extractErrorMessage } from "./extractErrorMessage.js";

describe("extractErrorMessage - ordinary inputs", () => {
	it.each([
		[new Error("boom"), "boom"],
		[new TypeError("bad type"), "bad type"],
		["plain string", "plain string"],
		[42, "42"],
		[false, "false"],
		[10n, "10"],
		[Symbol("tag"), "Symbol(tag)"],
		[null, "null"],
		[undefined, "undefined"],
		[[1, "a", null], '[1,"a",null]'],
		[{ message: "from message" }, "from message"],
		[{ message: 1, error: "from error" }, "from error"],
		[{ reason: "from reason" }, "from reason"],
		[{ code: 500 }, '{"code":500}'],
		[
			Object.assign(Object.create(null), { message: "no prototype" }),
			"no prototype",
		],
		[Object.create(null), "{}"],
		[() => 1, "() => 1"],
	])("%p -> %p", (input, expected) => {
		expect(extractErrorMessage(input)).toBe(expected);
	});
});

describe("extractErrorMessage - never throws", () => {
	it("stringifies a cyclic array with String()", () => {
		const cyclic: unknown[] = [1];
		cyclic.push(cyclic);
		expect(extractErrorMessage(cyclic)).toBe("1,");
	});

	it("stringifies an array holding a BigInt with String()", () => {
		expect(extractErrorMessage([1n, 2])).toBe("1,2");
	});

	it("falls back to String() when a getter throws", () => {
		const error = {
			get message(): string {
				throw new Error("getter exploded");
			},
			code: 7,
		};
		expect(extractErrorMessage(error)).toBe("[object Object]");
	});

	it("survives a Proxy whose has and get traps throw", () => {
		const hostile = new Proxy(
			{},
			{
				has() {
					throw new Error("has trap");
				},
				get() {
					throw new Error("get trap");
				},
			},
		);
		expect(extractErrorMessage(hostile)).toBe("[unprintable error]");
	});

	it("falls back to JSON when toString throws", () => {
		const error = {
			code: 1,
			toString(): string {
				throw new Error("toString exploded");
			},
		};
		expect(extractErrorMessage(error)).toBe('{"code":1}');
	});

	it("returns a fixed string when every step throws", () => {
		const error: Record<string, unknown> = {
			[Symbol.toPrimitive]() {
				throw new Error("toPrimitive exploded");
			},
		};
		error.self = error;
		expect(extractErrorMessage(error)).toBe("[unprintable error]");
	});

	it("handles a cyclic object with no prototype", () => {
		const error = Object.create(null) as Record<string, unknown>;
		error.self = error;
		expect(extractErrorMessage(error)).toBe("[unprintable error]");
	});

	it("handles a revoked Proxy", () => {
		const { proxy, revoke } = Proxy.revocable({ message: "gone" }, {});
		revoke();
		expect(extractErrorMessage(proxy)).toBe("[unprintable error]");
	});

	it("handles an Error whose message is not a string", () => {
		const error = new Error("original");
		(error as { message: unknown }).message = 42;
		expect(extractErrorMessage(error)).toBeTypeOf("string");
	});
});
