import { ISSUES } from "./errors.js";
import {
	hasJsonSchema,
	hasValidate,
	type StandardJSONSchemaV1,
	type StandardSchemaV1,
	type StandardTypedV1,
} from "./types.js";

/**
 * Output type for OkSchema - wraps inner schema's types with Ok structure.
 *
 * Preserves the capabilities of the input schema:
 * - If input has validate, output has validate
 * - If input has jsonSchema, output has jsonSchema
 */
export type Ok<TSchema extends StandardTypedV1> = {
	readonly "~standard": {
		readonly version: 1;
		readonly vendor: "wellcrafted";
		readonly types: {
			readonly input: {
				data: StandardTypedV1.InferInput<TSchema>;
				error: null;
			};
			readonly output: {
				data: StandardTypedV1.InferOutput<TSchema>;
				error: null;
			};
		};
	} & (TSchema extends StandardSchemaV1
		? {
				readonly validate: StandardSchemaV1.Props<
					{ data: StandardTypedV1.InferInput<TSchema>; error: null },
					{ data: StandardTypedV1.InferOutput<TSchema>; error: null }
				>["validate"];
			}
		: Record<string, never>) &
		(TSchema extends StandardJSONSchemaV1
			? { readonly jsonSchema: StandardJSONSchemaV1.Converter }
			: Record<string, never>);
};

function createOkValidate<TSchema extends StandardSchemaV1>(
	innerSchema: TSchema,
): StandardSchemaV1.Props<
	{ data: StandardTypedV1.InferInput<TSchema>; error: null },
	{ data: StandardTypedV1.InferOutput<TSchema>; error: null }
>["validate"] {
	return (value: unknown) => {
		if (typeof value !== "object" || value === null) {
			return { issues: [ISSUES.EXPECTED_OBJECT] };
		}

		if (!("data" in value) || !("error" in value)) {
			return { issues: [ISSUES.EXPECTED_DATA_ERROR_PROPS] };
		}

		const obj = value as { data: unknown; error: unknown };

		if (obj.error !== null) {
			return { issues: [ISSUES.EXPECTED_ERROR_NULL] };
		}

		const innerResult = innerSchema["~standard"].validate(obj.data);

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
	};
}

function createOkJsonSchema<TSchema extends StandardJSONSchemaV1>(
	innerSchema: TSchema,
): StandardJSONSchemaV1.Converter {
	return {
		input(options: StandardJSONSchemaV1.Options) {
			return {
				type: "object",
				properties: {
					data: innerSchema["~standard"].jsonSchema.input(options),
					error: { type: "null" },
				},
				required: ["data", "error"],
				additionalProperties: false,
			};
		},
		output(options: StandardJSONSchemaV1.Options) {
			return {
				type: "object",
				properties: {
					data: innerSchema["~standard"].jsonSchema.output(options),
					error: { type: "null" },
				},
				required: ["data", "error"],
				additionalProperties: false,
			};
		},
	};
}

/**
 * Wraps a Standard Schema into an Ok variant schema.
 *
 * Takes a schema for type T and returns a schema for `{ data: T, error: null }`.
 * Preserves the capabilities of the input schema (validate, jsonSchema, or both).
 *
 * @example
 * ```typescript
 * import { z } from "zod";
 * import { OkSchema } from "wellcrafted/standard-schema";
 *
 * const userSchema = z.object({ name: z.string() });
 * const okUserSchema = OkSchema(userSchema);
 *
 * // Validates: { data: { name: "Alice" }, error: null }
 * const result = okUserSchema["~standard"].validate({
 *   data: { name: "Alice" },
 *   error: null,
 * });
 * ```
 */
export function OkSchema<TSchema extends StandardTypedV1>(
	innerSchema: TSchema,
): Ok<TSchema> {
	const base = {
		"~standard": {
			version: 1 as const,
			vendor: "wellcrafted",
			types: {
				input: undefined as unknown as {
					data: StandardTypedV1.InferInput<TSchema>;
					error: null;
				},
				output: undefined as unknown as {
					data: StandardTypedV1.InferOutput<TSchema>;
					error: null;
				},
			},
		},
	};

	if (hasValidate(innerSchema)) {
		(base["~standard"] as Record<string, unknown>).validate =
			createOkValidate(innerSchema);
	}

	if (hasJsonSchema(innerSchema)) {
		(base["~standard"] as Record<string, unknown>).jsonSchema =
			createOkJsonSchema(innerSchema);
	}

	return base as Ok<TSchema>;
}
