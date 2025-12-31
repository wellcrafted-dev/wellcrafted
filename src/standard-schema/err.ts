import {
	hasJsonSchema,
	hasValidate,
	type StandardJSONSchemaV1,
	type StandardSchemaV1,
	type StandardTypedV1,
} from "./types.js";

/**
 * Output type for ErrSchema - wraps inner schema's types with Err structure.
 *
 * Preserves the capabilities of the input schema:
 * - If input has validate, output has validate
 * - If input has jsonSchema, output has jsonSchema
 */
export type Err<TSchema extends StandardTypedV1> = {
	readonly "~standard": {
		readonly version: 1;
		readonly vendor: "wellcrafted";
		readonly types: {
			readonly input: {
				data: null;
				error: StandardTypedV1.InferInput<TSchema>;
			};
			readonly output: {
				data: null;
				error: StandardTypedV1.InferOutput<TSchema>;
			};
		};
	} & (TSchema extends StandardSchemaV1
		? {
				readonly validate: StandardSchemaV1.Props<
					{ data: null; error: StandardTypedV1.InferInput<TSchema> },
					{ data: null; error: StandardTypedV1.InferOutput<TSchema> }
				>["validate"];
			}
		: Record<string, never>) &
		(TSchema extends StandardJSONSchemaV1
			? { readonly jsonSchema: StandardJSONSchemaV1.Converter }
			: Record<string, never>);
};

function createErrValidate<TSchema extends StandardSchemaV1>(
	innerSchema: TSchema,
): StandardSchemaV1.Props<
	{ data: null; error: StandardTypedV1.InferInput<TSchema> },
	{ data: null; error: StandardTypedV1.InferOutput<TSchema> }
>["validate"] {
	return (value: unknown) => {
		if (typeof value !== "object" || value === null) {
			return { issues: [{ message: "Expected object" }] };
		}

		if (!("data" in value) || !("error" in value)) {
			return {
				issues: [
					{ message: "Expected object with 'data' and 'error' properties" },
				],
			};
		}

		const obj = value as { data: unknown; error: unknown };

		if (obj.data !== null) {
			return {
				issues: [{ message: "Expected 'data' to be null for Err variant" }],
			};
		}

		const innerResult = innerSchema["~standard"].validate(obj.error);

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

function createErrJsonSchema<TSchema extends StandardJSONSchemaV1>(
	innerSchema: TSchema,
): StandardJSONSchemaV1.Converter {
	return {
		input(options: StandardJSONSchemaV1.Options) {
			return {
				type: "object",
				properties: {
					data: { type: "null" },
					error: innerSchema["~standard"].jsonSchema.input(options),
				},
				required: ["data", "error"],
				additionalProperties: false,
			};
		},
		output(options: StandardJSONSchemaV1.Options) {
			return {
				type: "object",
				properties: {
					data: { type: "null" },
					error: innerSchema["~standard"].jsonSchema.output(options),
				},
				required: ["data", "error"],
				additionalProperties: false,
			};
		},
	};
}

/**
 * Wraps a Standard Schema into an Err variant schema.
 *
 * Takes a schema for type E and returns a schema for `{ data: null, error: E }`.
 * Preserves the capabilities of the input schema (validate, jsonSchema, or both).
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { ErrSchema } from "wellcrafted/standard-schema";
 *
 * const errorSchema = z.object({ code: z.string(), message: z.string() });
 * const errResultSchema = ErrSchema(errorSchema);
 *
 * // Validates: { data: null, error: { code: "NOT_FOUND", message: "User not found" } }
 * const result = errResultSchema["~standard"].validate({
 *   data: null,
 *   error: { code: "NOT_FOUND", message: "User not found" },
 * });
 * ```
 */
export function ErrSchema<TSchema extends StandardTypedV1>(
	innerSchema: TSchema,
): Err<TSchema> {
	const base = {
		"~standard": {
			version: 1 as const,
			vendor: "wellcrafted",
			types: {
				input: undefined as unknown as {
					data: null;
					error: StandardTypedV1.InferInput<TSchema>;
				},
				output: undefined as unknown as {
					data: null;
					error: StandardTypedV1.InferOutput<TSchema>;
				},
			},
		},
	};

	if (hasValidate(innerSchema)) {
		(base["~standard"] as Record<string, unknown>).validate =
			createErrValidate(innerSchema);
	}

	if (hasJsonSchema(innerSchema)) {
		(base["~standard"] as Record<string, unknown>).jsonSchema =
			createErrJsonSchema(innerSchema);
	}

	return base as Err<TSchema>;
}
