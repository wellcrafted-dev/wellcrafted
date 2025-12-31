import { describe, expect, it } from "vitest";
import { ErrSchema, OkSchema, ResultSchema } from "./index.js";
import type { StandardJSONSchemaV1, StandardSchemaV1 } from "./types.js";

function createMockStringSchema(): StandardSchemaV1<string, string> &
	StandardJSONSchemaV1<string, string> {
	return {
		"~standard": {
			version: 1,
			vendor: "test",
			types: {
				input: "" as string,
				output: "" as string,
			},
			validate(value: unknown) {
				if (typeof value !== "string") {
					return { issues: [{ message: "Expected string" }] };
				}
				return { value };
			},
			jsonSchema: {
				input: () => ({ type: "string" }),
				output: () => ({ type: "string" }),
			},
		},
	};
}

function createMockObjectSchema(): StandardSchemaV1<
	{ name: string },
	{ name: string }
> &
	StandardJSONSchemaV1<{ name: string }, { name: string }> {
	return {
		"~standard": {
			version: 1,
			vendor: "test",
			types: {
				input: { name: "" } as { name: string },
				output: { name: "" } as { name: string },
			},
			validate(value: unknown) {
				if (
					typeof value !== "object" ||
					value === null ||
					!("name" in value) ||
					typeof (value as { name: unknown }).name !== "string"
				) {
					return { issues: [{ message: "Expected object with name string" }] };
				}
				return { value: value as { name: string } };
			},
			jsonSchema: {
				input: () => ({
					type: "object",
					properties: { name: { type: "string" } },
					required: ["name"],
				}),
				output: () => ({
					type: "object",
					properties: { name: { type: "string" } },
					required: ["name"],
				}),
			},
		},
	};
}

function createValidationOnlySchema(): StandardSchemaV1<string, string> {
	return {
		"~standard": {
			version: 1,
			vendor: "test",
			types: {
				input: "" as string,
				output: "" as string,
			},
			validate(value: unknown) {
				if (typeof value !== "string") {
					return { issues: [{ message: "Expected string" }] };
				}
				return { value };
			},
		},
	};
}

describe("OkSchema", () => {
	describe("validation", () => {
		it("validates Ok variant successfully", () => {
			const stringSchema = createMockStringSchema();
			const okSchema = OkSchema(stringSchema);

			const result = okSchema["~standard"].validate({
				data: "hello",
				error: null,
			});

			expect(result).toEqual({ value: { data: "hello", error: null } });
		});

		it("rejects non-object values", () => {
			const stringSchema = createMockStringSchema();
			const okSchema = OkSchema(stringSchema);

			const result = okSchema["~standard"].validate("not an object");

			expect(result).toEqual({ issues: [{ message: "Expected object" }] });
		});

		it("rejects objects without data/error properties", () => {
			const stringSchema = createMockStringSchema();
			const okSchema = OkSchema(stringSchema);

			const result = okSchema["~standard"].validate({ foo: "bar" });

			expect(result).toEqual({
				issues: [
					{ message: "Expected object with 'data' and 'error' properties" },
				],
			});
		});

		it("rejects Err variant (error not null)", () => {
			const stringSchema = createMockStringSchema();
			const okSchema = OkSchema(stringSchema);

			const result = okSchema["~standard"].validate({
				data: null,
				error: "some error",
			});

			expect(result).toEqual({
				issues: [{ message: "Expected 'error' to be null for Ok variant" }],
			});
		});

		it("propagates inner schema validation errors with path prefix", () => {
			const stringSchema = createMockStringSchema();
			const okSchema = OkSchema(stringSchema);

			const result = okSchema["~standard"].validate({
				data: 123,
				error: null,
			});

			expect(result).toEqual({
				issues: [{ message: "Expected string", path: ["data"] }],
			});
		});

		it("validates nested objects and prefixes paths", () => {
			const objectSchema = createMockObjectSchema();
			const okSchema = OkSchema(objectSchema);

			const result = okSchema["~standard"].validate({
				data: { name: "Alice" },
				error: null,
			});

			expect(result).toEqual({
				value: { data: { name: "Alice" }, error: null },
			});
		});
	});

	describe("jsonSchema", () => {
		it("generates JSON Schema for Ok variant", () => {
			const stringSchema = createMockStringSchema();
			const okSchema = OkSchema(stringSchema);

			const inputSchema = okSchema["~standard"].jsonSchema.input({
				target: "draft-2020-12",
			});

			expect(inputSchema).toEqual({
				type: "object",
				properties: {
					data: { type: "string" },
					error: { type: "null" },
				},
				required: ["data", "error"],
				additionalProperties: false,
			});
		});
	});

	describe("capability preservation", () => {
		it("includes validate when input has validate", () => {
			const validationOnly = createValidationOnlySchema();
			const okSchema = OkSchema(validationOnly);

			expect(okSchema["~standard"].validate).toBeDefined();
		});

		it("does not include jsonSchema when input lacks it", () => {
			const validationOnly = createValidationOnlySchema();
			const okSchema = OkSchema(validationOnly);

			expect(
				(okSchema["~standard"] as Record<string, unknown>).jsonSchema,
			).toBeUndefined();
		});
	});
});

describe("ErrSchema", () => {
	describe("validation", () => {
		it("validates Err variant successfully", () => {
			const stringSchema = createMockStringSchema();
			const errSchema = ErrSchema(stringSchema);

			const result = errSchema["~standard"].validate({
				data: null,
				error: "error message",
			});

			expect(result).toEqual({
				value: { data: null, error: "error message" },
			});
		});

		it("rejects Ok variant (data not null)", () => {
			const stringSchema = createMockStringSchema();
			const errSchema = ErrSchema(stringSchema);

			const result = errSchema["~standard"].validate({
				data: "some data",
				error: null,
			});

			expect(result).toEqual({
				issues: [{ message: "Expected 'data' to be null for Err variant" }],
			});
		});

		it("propagates inner schema validation errors with path prefix", () => {
			const stringSchema = createMockStringSchema();
			const errSchema = ErrSchema(stringSchema);

			const result = errSchema["~standard"].validate({
				data: null,
				error: 123,
			});

			expect(result).toEqual({
				issues: [{ message: "Expected string", path: ["error"] }],
			});
		});
	});

	describe("jsonSchema", () => {
		it("generates JSON Schema for Err variant", () => {
			const stringSchema = createMockStringSchema();
			const errSchema = ErrSchema(stringSchema);

			const inputSchema = errSchema["~standard"].jsonSchema.input({
				target: "draft-2020-12",
			});

			expect(inputSchema).toEqual({
				type: "object",
				properties: {
					data: { type: "null" },
					error: { type: "string" },
				},
				required: ["data", "error"],
				additionalProperties: false,
			});
		});
	});
});

describe("ResultSchema", () => {
	describe("validation", () => {
		it("validates Ok variant successfully", () => {
			const dataSchema = createMockObjectSchema();
			const errorSchema = createMockStringSchema();
			const resultSchema = ResultSchema(dataSchema, errorSchema);

			const result = resultSchema["~standard"].validate({
				data: { name: "Alice" },
				error: null,
			});

			expect(result).toEqual({
				value: { data: { name: "Alice" }, error: null },
			});
		});

		it("validates Err variant successfully", () => {
			const dataSchema = createMockObjectSchema();
			const errorSchema = createMockStringSchema();
			const resultSchema = ResultSchema(dataSchema, errorSchema);

			const result = resultSchema["~standard"].validate({
				data: null,
				error: "something went wrong",
			});

			expect(result).toEqual({
				value: { data: null, error: "something went wrong" },
			});
		});

		it("rejects invalid Result (neither null)", () => {
			const dataSchema = createMockObjectSchema();
			const errorSchema = createMockStringSchema();
			const resultSchema = ResultSchema(dataSchema, errorSchema);

			const result = resultSchema["~standard"].validate({
				data: { name: "Alice" },
				error: "oops",
			});

			expect(result).toEqual({
				issues: [
					{
						message:
							"Invalid Result: exactly one of 'data' or 'error' must be null",
					},
				],
			});
		});

		it("propagates data schema errors with path prefix", () => {
			const dataSchema = createMockObjectSchema();
			const errorSchema = createMockStringSchema();
			const resultSchema = ResultSchema(dataSchema, errorSchema);

			const result = resultSchema["~standard"].validate({
				data: { invalid: true },
				error: null,
			});

			expect(result).toEqual({
				issues: [
					{ message: "Expected object with name string", path: ["data"] },
				],
			});
		});

		it("propagates error schema errors with path prefix", () => {
			const dataSchema = createMockObjectSchema();
			const errorSchema = createMockStringSchema();
			const resultSchema = ResultSchema(dataSchema, errorSchema);

			const result = resultSchema["~standard"].validate({
				data: null,
				error: 123,
			});

			expect(result).toEqual({
				issues: [{ message: "Expected string", path: ["error"] }],
			});
		});
	});

	describe("jsonSchema", () => {
		it("generates JSON Schema with oneOf for discriminated union", () => {
			const dataSchema = createMockObjectSchema();
			const errorSchema = createMockStringSchema();
			const resultSchema = ResultSchema(dataSchema, errorSchema);

			const inputSchema = resultSchema["~standard"].jsonSchema.input({
				target: "draft-2020-12",
			});

			expect(inputSchema).toEqual({
				oneOf: [
					{
						type: "object",
						properties: {
							data: {
								type: "object",
								properties: { name: { type: "string" } },
								required: ["name"],
							},
							error: { type: "null" },
						},
						required: ["data", "error"],
						additionalProperties: false,
					},
					{
						type: "object",
						properties: {
							data: { type: "null" },
							error: { type: "string" },
						},
						required: ["data", "error"],
						additionalProperties: false,
					},
				],
			});
		});
	});

	describe("edge cases", () => {
		it("handles both data and error being null", () => {
			const dataSchema = createMockStringSchema();
			const errorSchema = createMockStringSchema();
			const resultSchema = ResultSchema(dataSchema, errorSchema);

			const result = resultSchema["~standard"].validate({
				data: null,
				error: null,
			});

			expect(result).toEqual({
				value: { data: null, error: null },
			});
		});
	});
});

describe("type inference", () => {
	it("OkSchema infers correct types", () => {
		const stringSchema = createMockStringSchema();
		const okSchema = OkSchema(stringSchema);

		type Input = (typeof okSchema)["~standard"]["types"]["input"];
		type Output = (typeof okSchema)["~standard"]["types"]["output"];

		const _inputCheck: Input = { data: "hello", error: null };
		const _outputCheck: Output = { data: "world", error: null };

		expect(true).toBe(true);
	});

	it("ErrSchema infers correct types", () => {
		const stringSchema = createMockStringSchema();
		const errSchema = ErrSchema(stringSchema);

		type Input = (typeof errSchema)["~standard"]["types"]["input"];
		type Output = (typeof errSchema)["~standard"]["types"]["output"];

		const _inputCheck: Input = { data: null, error: "error" };
		const _outputCheck: Output = { data: null, error: "error" };

		expect(true).toBe(true);
	});

	it("ResultSchema infers correct union types", () => {
		const dataSchema = createMockObjectSchema();
		const errorSchema = createMockStringSchema();
		const resultSchema = ResultSchema(dataSchema, errorSchema);

		type Input = (typeof resultSchema)["~standard"]["types"]["input"];
		type Output = (typeof resultSchema)["~standard"]["types"]["output"];

		const _inputOk: Input = { data: { name: "Alice" }, error: null };
		const _inputErr: Input = { data: null, error: "oops" };
		const _outputOk: Output = { data: { name: "Bob" }, error: null };
		const _outputErr: Output = { data: null, error: "error" };

		expect(true).toBe(true);
	});
});
