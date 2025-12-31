import type { StandardSchemaV1 } from "./types.js";

export const FAILURES = {
	EXPECTED_OBJECT: { issues: [{ message: "Expected object" }] },
	EXPECTED_DATA_ERROR_PROPS: {
		issues: [{ message: "Expected object with 'data' and 'error' properties" }],
	},
	EXPECTED_ERROR_NULL: {
		issues: [
			{
				message: "Expected 'error' to be null for Ok variant",
				path: ["error"],
			},
		],
	},
	EXPECTED_DATA_NULL: {
		issues: [
			{
				message: "Expected 'data' to be null for Err variant",
				path: ["data"],
			},
		],
	},
	EXPECTED_ERROR_NOT_NULL: {
		issues: [
			{
				message: "Expected 'error' to be non-null for Err variant",
				path: ["error"],
			},
		],
	},
	INVALID_RESULT: {
		issues: [
			{
				message:
					"Invalid Result: exactly one of 'data' or 'error' must be null",
				path: ["data", "error"],
			},
		],
	},
} as const satisfies Record<string, StandardSchemaV1.FailureResult>;
