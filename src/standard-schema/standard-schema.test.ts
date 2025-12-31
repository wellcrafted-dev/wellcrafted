import { type } from "arktype";
import * as v from "valibot";
import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { ErrSchema, FAILURES, OkSchema, ResultSchema } from "./index.js";

describe("OkSchema", () => {
	describe("with Zod", () => {
		const stringSchema = z.string();
		const okSchema = OkSchema(stringSchema);

		it("validates Ok variant successfully", () => {
			const result = okSchema["~standard"].validate({
				data: "hello",
				error: null,
			});

			expect(result).toEqual({ value: { data: "hello", error: null } });
		});

		it("rejects non-object values", () => {
			const result = okSchema["~standard"].validate("not an object");

			expect(result).toEqual(FAILURES.EXPECTED_OBJECT);
		});

		it("rejects objects without data/error properties", () => {
			const result = okSchema["~standard"].validate({ foo: "bar" });

			expect(result).toEqual(FAILURES.EXPECTED_DATA_ERROR_PROPS);
		});

		it("rejects Err variant (error not null)", () => {
			const result = okSchema["~standard"].validate({
				data: null,
				error: "some error",
			});

			expect(result).toEqual(FAILURES.EXPECTED_ERROR_NULL);
		});

		it("propagates inner schema validation errors with path prefix", () => {
			const result = okSchema["~standard"].validate({
				data: 123,
				error: null,
			});

			expect(result).toHaveProperty("issues");
			const issues = (result as { issues: unknown[] }).issues;
			expect(issues[0]).toHaveProperty("path");
			expect((issues[0] as { path: unknown[] }).path[0]).toBe("data");
		});

		it("validates complex objects", () => {
			const userSchema = z.object({ id: z.string(), name: z.string() });
			const okUserSchema = OkSchema(userSchema);

			const result = okUserSchema["~standard"].validate({
				data: { id: "123", name: "Alice" },
				error: null,
			});

			expect(result).toEqual({
				value: { data: { id: "123", name: "Alice" }, error: null },
			});
		});
	});

	describe("with Valibot", () => {
		const stringSchema = v.string();
		const okSchema = OkSchema(stringSchema);

		it("validates Ok variant successfully", () => {
			const result = okSchema["~standard"].validate({
				data: "hello from valibot",
				error: null,
			});

			expect(result).toEqual({
				value: { data: "hello from valibot", error: null },
			});
		});

		it("propagates validation errors with path prefix", () => {
			const result = okSchema["~standard"].validate({
				data: 42,
				error: null,
			});

			expect(result).toHaveProperty("issues");
			const issues = (result as { issues: unknown[] }).issues;
			expect(issues[0]).toHaveProperty("path");
			expect((issues[0] as { path: unknown[] }).path[0]).toBe("data");
		});

		it("validates complex objects", () => {
			const userSchema = v.object({
				id: v.string(),
				email: v.pipe(v.string(), v.email()),
			});
			const okUserSchema = OkSchema(userSchema);

			const result = okUserSchema["~standard"].validate({
				data: { id: "123", email: "alice@example.com" },
				error: null,
			});

			expect(result).toEqual({
				value: { data: { id: "123", email: "alice@example.com" }, error: null },
			});
		});
	});

	describe("with ArkType", () => {
		const stringSchema = type("string");
		const okSchema = OkSchema(stringSchema);

		it("validates Ok variant successfully", () => {
			const result = okSchema["~standard"].validate({
				data: "hello from arktype",
				error: null,
			});

			expect(result).toEqual({
				value: { data: "hello from arktype", error: null },
			});
		});

		it("propagates validation errors with path prefix", () => {
			const result = okSchema["~standard"].validate({
				data: 999,
				error: null,
			});

			expect(result).toHaveProperty("issues");
			const issues = (result as { issues: unknown[] }).issues;
			expect(issues[0]).toHaveProperty("path");
			expect((issues[0] as { path: unknown[] }).path[0]).toBe("data");
		});

		it("validates complex objects", () => {
			const userSchema = type({ id: "string", age: "number > 0" });
			const okUserSchema = OkSchema(userSchema);

			const result = okUserSchema["~standard"].validate({
				data: { id: "123", age: 25 },
				error: null,
			});

			expect(result).toEqual({
				value: { data: { id: "123", age: 25 }, error: null },
			});
		});
	});
});

describe("ErrSchema", () => {
	describe("with Zod", () => {
		const errorSchema = z.object({ code: z.string(), message: z.string() });
		const errSchema = ErrSchema(errorSchema);

		it("validates Err variant successfully", () => {
			const result = errSchema["~standard"].validate({
				data: null,
				error: { code: "NOT_FOUND", message: "User not found" },
			});

			expect(result).toEqual({
				value: {
					data: null,
					error: { code: "NOT_FOUND", message: "User not found" },
				},
			});
		});

		it("rejects Ok variant (data not null)", () => {
			const result = errSchema["~standard"].validate({
				data: "some data",
				error: null,
			});

			expect(result).toEqual(FAILURES.EXPECTED_DATA_NULL);
		});

		it("propagates inner schema validation errors with path prefix", () => {
			const result = errSchema["~standard"].validate({
				data: null,
				error: { code: 123, message: "wrong type" },
			});

			expect(result).toHaveProperty("issues");
			const issues = (result as { issues: unknown[] }).issues;
			expect(issues[0]).toHaveProperty("path");
			expect((issues[0] as { path: unknown[] }).path[0]).toBe("error");
		});
	});

	describe("with Valibot", () => {
		const errorSchema = v.object({
			code: v.string(),
			details: v.optional(v.string()),
		});
		const errSchema = ErrSchema(errorSchema);

		it("validates Err variant successfully", () => {
			const result = errSchema["~standard"].validate({
				data: null,
				error: { code: "VALIDATION_ERROR" },
			});

			expect(result).toEqual({
				value: { data: null, error: { code: "VALIDATION_ERROR" } },
			});
		});

		it("validates with optional fields", () => {
			const result = errSchema["~standard"].validate({
				data: null,
				error: { code: "ERROR", details: "Something went wrong" },
			});

			expect(result).toEqual({
				value: {
					data: null,
					error: { code: "ERROR", details: "Something went wrong" },
				},
			});
		});
	});

	describe("with ArkType", () => {
		const errorSchema = type({ kind: "'error'", message: "string" });
		const errSchema = ErrSchema(errorSchema);

		it("validates Err variant successfully", () => {
			const result = errSchema["~standard"].validate({
				data: null,
				error: { kind: "error", message: "Something failed" },
			});

			expect(result).toEqual({
				value: {
					data: null,
					error: { kind: "error", message: "Something failed" },
				},
			});
		});
	});
});

describe("ResultSchema", () => {
	describe("with Zod", () => {
		const userSchema = z.object({ id: z.string(), name: z.string() });
		const errorSchema = z.object({ code: z.string(), message: z.string() });
		const resultSchema = ResultSchema(userSchema, errorSchema);

		it("validates Ok variant successfully", () => {
			const result = resultSchema["~standard"].validate({
				data: { id: "1", name: "Alice" },
				error: null,
			});

			expect(result).toEqual({
				value: { data: { id: "1", name: "Alice" }, error: null },
			});
		});

		it("validates Err variant successfully", () => {
			const result = resultSchema["~standard"].validate({
				data: null,
				error: { code: "NOT_FOUND", message: "User not found" },
			});

			expect(result).toEqual({
				value: {
					data: null,
					error: { code: "NOT_FOUND", message: "User not found" },
				},
			});
		});

		it("rejects invalid Result (neither null)", () => {
			const result = resultSchema["~standard"].validate({
				data: { id: "1", name: "Alice" },
				error: { code: "ERROR", message: "oops" },
			});

			expect(result).toEqual(FAILURES.INVALID_RESULT);
		});

		it("propagates data schema errors with path prefix", () => {
			const result = resultSchema["~standard"].validate({
				data: { id: 123, name: "Alice" },
				error: null,
			});

			expect(result).toHaveProperty("issues");
			const issues = (result as { issues: unknown[] }).issues;
			expect(issues[0]).toHaveProperty("path");
			expect((issues[0] as { path: unknown[] }).path[0]).toBe("data");
		});

		it("propagates error schema errors with path prefix", () => {
			const result = resultSchema["~standard"].validate({
				data: null,
				error: { code: 123, message: "wrong" },
			});

			expect(result).toHaveProperty("issues");
			const issues = (result as { issues: unknown[] }).issues;
			expect(issues[0]).toHaveProperty("path");
			expect((issues[0] as { path: unknown[] }).path[0]).toBe("error");
		});
	});

	describe("with Valibot", () => {
		const dataSchema = v.object({ items: v.array(v.string()) });
		const errorSchema = v.object({ reason: v.string() });
		const resultSchema = ResultSchema(dataSchema, errorSchema);

		it("validates Ok variant with arrays", () => {
			const result = resultSchema["~standard"].validate({
				data: { items: ["a", "b", "c"] },
				error: null,
			});

			expect(result).toEqual({
				value: { data: { items: ["a", "b", "c"] }, error: null },
			});
		});

		it("validates Err variant", () => {
			const result = resultSchema["~standard"].validate({
				data: null,
				error: { reason: "No items available" },
			});

			expect(result).toEqual({
				value: { data: null, error: { reason: "No items available" } },
			});
		});
	});

	describe("with ArkType", () => {
		const dataSchema = type({ count: "number", active: "boolean" });
		const errorSchema = type({ errorCode: "number" });
		const resultSchema = ResultSchema(dataSchema, errorSchema);

		it("validates Ok variant", () => {
			const result = resultSchema["~standard"].validate({
				data: { count: 42, active: true },
				error: null,
			});

			expect(result).toEqual({
				value: { data: { count: 42, active: true }, error: null },
			});
		});

		it("validates Err variant", () => {
			const result = resultSchema["~standard"].validate({
				data: null,
				error: { errorCode: 404 },
			});

			expect(result).toEqual({
				value: { data: null, error: { errorCode: 404 } },
			});
		});
	});

	describe("mixed libraries", () => {
		it("works with Zod data and Valibot error schemas", () => {
			const dataSchema = z.object({ value: z.number() });
			const errorSchema = v.object({ msg: v.string() });
			const resultSchema = ResultSchema(dataSchema, errorSchema);

			const okResult = resultSchema["~standard"].validate({
				data: { value: 100 },
				error: null,
			});
			expect(okResult).toEqual({
				value: { data: { value: 100 }, error: null },
			});

			const errResult = resultSchema["~standard"].validate({
				data: null,
				error: { msg: "failed" },
			});
			expect(errResult).toEqual({
				value: { data: null, error: { msg: "failed" } },
			});
		});
	});
});

describe("edge cases", () => {
	it("handles both data and error being null", () => {
		const dataSchema = z.string();
		const errorSchema = z.string();
		const resultSchema = ResultSchema(dataSchema, errorSchema);

		const result = resultSchema["~standard"].validate({
			data: null,
			error: null,
		});

		expect(result).toEqual({
			value: { data: null, error: null },
		} as unknown as typeof result);
	});

	it("handles null as valid data value in Ok", () => {
		const dataSchema = z.null();
		const okSchema = OkSchema(dataSchema);

		const result = okSchema["~standard"].validate({
			data: null,
			error: null,
		});

		expect(result).toEqual({
			value: { data: null, error: null },
		});
	});

	it("handles empty objects", () => {
		const dataSchema = z.object({});
		const okSchema = OkSchema(dataSchema);

		const result = okSchema["~standard"].validate({
			data: {},
			error: null,
		});

		expect(result).toEqual({
			value: { data: {}, error: null },
		});
	});

	it("handles deeply nested validation errors", () => {
		const dataSchema = z.object({
			user: z.object({
				profile: z.object({
					name: z.string(),
				}),
			}),
		});
		const okSchema = OkSchema(dataSchema);

		const result = okSchema["~standard"].validate({
			data: { user: { profile: { name: 123 } } },
			error: null,
		});

		expect(result).toHaveProperty("issues");
		const issues = (result as { issues: unknown[] }).issues;
		expect(issues[0]).toHaveProperty("path");
		const path = (issues[0] as { path: unknown[] }).path;
		expect(path[0]).toBe("data");
	});
});

describe("type inference", () => {
	it("OkSchema infers correct types from Zod", () => {
		const userSchema = z.object({ id: z.string() });
		const okSchema = OkSchema(userSchema);

		type Input = (typeof okSchema)["~standard"]["types"]["input"];
		type Output = (typeof okSchema)["~standard"]["types"]["output"];

		const _inputCheck: Input = { data: { id: "test" }, error: null };
		const _outputCheck: Output = { data: { id: "test" }, error: null };

		expect(true).toBe(true);
	});

	it("ErrSchema infers correct types from Valibot", () => {
		const errorSchema = v.object({ code: v.number() });
		const errSchema = ErrSchema(errorSchema);

		type Input = (typeof errSchema)["~standard"]["types"]["input"];
		type Output = (typeof errSchema)["~standard"]["types"]["output"];

		const _inputCheck: Input = { data: null, error: { code: 404 } };
		const _outputCheck: Output = { data: null, error: { code: 500 } };

		expect(true).toBe(true);
	});

	it("ResultSchema infers correct union types", () => {
		const dataSchema = z.object({ name: z.string() });
		const errorSchema = z.object({ message: z.string() });
		const resultSchema = ResultSchema(dataSchema, errorSchema);

		type Input = (typeof resultSchema)["~standard"]["types"]["input"];
		type Output = (typeof resultSchema)["~standard"]["types"]["output"];

		const _inputOk: Input = { data: { name: "Alice" }, error: null };
		const _inputErr: Input = { data: null, error: { message: "oops" } };
		const _outputOk: Output = { data: { name: "Bob" }, error: null };
		const _outputErr: Output = { data: null, error: { message: "error" } };

		expect(true).toBe(true);
	});
});
