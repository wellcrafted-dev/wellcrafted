import { ISSUES } from "./errors.js";
import {
	hasJsonSchema,
	hasValidate,
	type StandardJSONSchemaV1,
	type StandardSchemaV1,
	type StandardTypedV1,
} from "./types.js";

/**
 * Output type for ResultSchema - creates a discriminated union of Ok and Err.
 *
 * Preserves the capabilities of the input schemas:
 * - If both inputs have validate, output has validate
 * - If both inputs have jsonSchema, output has jsonSchema
 */
export type Result<
	TDataSchema extends StandardTypedV1,
	TErrorSchema extends StandardTypedV1,
> = {
	readonly "~standard": {
		readonly version: 1;
		readonly vendor: "wellcrafted";
		readonly types: {
			readonly input:
				| { data: StandardTypedV1.InferInput<TDataSchema>; error: null }
				| { data: null; error: StandardTypedV1.InferInput<TErrorSchema> };
			readonly output:
				| { data: StandardTypedV1.InferOutput<TDataSchema>; error: null }
				| { data: null; error: StandardTypedV1.InferOutput<TErrorSchema> };
		};
	} & (TDataSchema extends StandardSchemaV1
		? TErrorSchema extends StandardSchemaV1
			? {
					readonly validate: StandardSchemaV1.Props<
						| {
								data: StandardTypedV1.InferInput<TDataSchema>;
								error: null;
						  }
						| {
								data: null;
								error: StandardTypedV1.InferInput<TErrorSchema>;
						  },
						| {
								data: StandardTypedV1.InferOutput<TDataSchema>;
								error: null;
						  }
						| {
								data: null;
								error: StandardTypedV1.InferOutput<TErrorSchema>;
						  }
					>["validate"];
				}
			: Record<string, never>
		: Record<string, never>) &
		(TDataSchema extends StandardJSONSchemaV1
			? TErrorSchema extends StandardJSONSchemaV1
				? { readonly jsonSchema: StandardJSONSchemaV1.Converter }
				: Record<string, never>
			: Record<string, never>);
};

function createResultValidate<
	TDataSchema extends StandardSchemaV1,
	TErrorSchema extends StandardSchemaV1,
>(
	dataSchema: TDataSchema,
	errorSchema: TErrorSchema,
): StandardSchemaV1.Props<
	| { data: StandardTypedV1.InferInput<TDataSchema>; error: null }
	| { data: null; error: StandardTypedV1.InferInput<TErrorSchema> },
	| { data: StandardTypedV1.InferOutput<TDataSchema>; error: null }
	| { data: null; error: StandardTypedV1.InferOutput<TErrorSchema> }
>["validate"] {
	return (value: unknown) => {
		if (typeof value !== "object" || value === null) {
			return { issues: [ISSUES.EXPECTED_OBJECT] };
		}

		if (!("data" in value) || !("error" in value)) {
			return { issues: [ISSUES.EXPECTED_DATA_ERROR_PROPS] };
		}

		const obj = value as { data: unknown; error: unknown };

		const isOkVariant = obj.error === null;
		const isErrVariant = obj.data === null;

		if (isOkVariant && isErrVariant) {
			return { value: { data: null as null, error: null as null } as never };
		}

		if (!isOkVariant && !isErrVariant) {
			return { issues: [ISSUES.INVALID_RESULT] };
		}

		if (isOkVariant) {
			const innerResult = dataSchema["~standard"].validate(obj.data);

			if (innerResult instanceof Promise) {
				return innerResult.then((r) => {
					if (r.issues) {
						return {
							issues: r.issues.map((issue: StandardSchemaV1.Issue) => ({
								...issue,
								path: ["data", ...(issue.path || [])],
							})),
						};
					}
					return { value: { data: r.value, error: null as null } };
				});
			}

			if (innerResult.issues) {
				return {
					issues: innerResult.issues.map((issue: StandardSchemaV1.Issue) => ({
						...issue,
						path: ["data", ...(issue.path || [])],
					})),
				};
			}

			return { value: { data: innerResult.value, error: null as null } };
		}

		const innerResult = errorSchema["~standard"].validate(obj.error);

		if (innerResult instanceof Promise) {
			return innerResult.then((r) => {
				if (r.issues) {
					return {
						issues: r.issues.map((issue: StandardSchemaV1.Issue) => ({
							...issue,
							path: ["error", ...(issue.path || [])],
						})),
					};
				}
				return { value: { data: null as null, error: r.value } };
			});
		}

		if (innerResult.issues) {
			return {
				issues: innerResult.issues.map((issue: StandardSchemaV1.Issue) => ({
					...issue,
					path: ["error", ...(issue.path || [])],
				})),
			};
		}

		return { value: { data: null as null, error: innerResult.value } };
	};
}

function createResultJsonSchema<
	TDataSchema extends StandardJSONSchemaV1,
	TErrorSchema extends StandardJSONSchemaV1,
>(
	dataSchema: TDataSchema,
	errorSchema: TErrorSchema,
): StandardJSONSchemaV1.Converter {
	return {
		input(options: StandardJSONSchemaV1.Options) {
			return {
				oneOf: [
					{
						type: "object",
						properties: {
							data: dataSchema["~standard"].jsonSchema.input(options),
							error: { type: "null" },
						},
						required: ["data", "error"],
						additionalProperties: false,
					},
					{
						type: "object",
						properties: {
							data: { type: "null" },
							error: errorSchema["~standard"].jsonSchema.input(options),
						},
						required: ["data", "error"],
						additionalProperties: false,
					},
				],
			};
		},
		output(options: StandardJSONSchemaV1.Options) {
			return {
				oneOf: [
					{
						type: "object",
						properties: {
							data: dataSchema["~standard"].jsonSchema.output(options),
							error: { type: "null" },
						},
						required: ["data", "error"],
						additionalProperties: false,
					},
					{
						type: "object",
						properties: {
							data: { type: "null" },
							error: errorSchema["~standard"].jsonSchema.output(options),
						},
						required: ["data", "error"],
						additionalProperties: false,
					},
				],
			};
		},
	};
}

/**
 * Combines two Standard Schemas into a Result discriminated union schema.
 *
 * Takes a data schema for type T and an error schema for type E, returning a schema
 * for `{ data: T, error: null } | { data: null, error: E }`.
 *
 * Preserves the capabilities of the input schemas - if both have validate, output
 * has validate; if both have jsonSchema, output has jsonSchema.
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { ResultSchema } from "wellcrafted/standard-schema";
 *
 * const userSchema = z.object({ id: z.string(), name: z.string() });
 * const errorSchema = z.object({ code: z.string(), message: z.string() });
 * const resultSchema = ResultSchema(userSchema, errorSchema);
 *
 * // Validates Ok variant: { data: { id: "1", name: "Alice" }, error: null }
 * // Validates Err variant: { data: null, error: { code: "NOT_FOUND", message: "..." } }
 * const result = resultSchema["~standard"].validate({
 *   data: { id: "1", name: "Alice" },
 *   error: null,
 * });
 * ```
 */
export function ResultSchema<
	TDataSchema extends StandardTypedV1,
	TErrorSchema extends StandardTypedV1,
>(
	dataSchema: TDataSchema,
	errorSchema: TErrorSchema,
): Result<TDataSchema, TErrorSchema> {
	const base = {
		"~standard": {
			version: 1 as const,
			vendor: "wellcrafted",
			types: {
				input: undefined as unknown as
					| { data: StandardTypedV1.InferInput<TDataSchema>; error: null }
					| { data: null; error: StandardTypedV1.InferInput<TErrorSchema> },
				output: undefined as unknown as
					| { data: StandardTypedV1.InferOutput<TDataSchema>; error: null }
					| { data: null; error: StandardTypedV1.InferOutput<TErrorSchema> },
			},
		},
	};

	if (hasValidate(dataSchema) && hasValidate(errorSchema)) {
		(base["~standard"] as Record<string, unknown>).validate =
			createResultValidate(dataSchema, errorSchema);
	}

	if (hasJsonSchema(dataSchema) && hasJsonSchema(errorSchema)) {
		(base["~standard"] as Record<string, unknown>).jsonSchema =
			createResultJsonSchema(dataSchema, errorSchema);
	}

	return base as Result<TDataSchema, TErrorSchema>;
}
