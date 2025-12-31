import type { StandardSchemaV1 } from "./types.js";

export const ISSUES = {
	EXPECTED_OBJECT: { message: "Expected object" },
	EXPECTED_DATA_ERROR_PROPS: {
		message: "Expected object with 'data' and 'error' properties",
	},
	EXPECTED_ERROR_NULL: {
		message: "Expected 'error' to be null for Ok variant",
		path: ["error"],
	},
	EXPECTED_DATA_NULL: {
		message: "Expected 'data' to be null for Err variant",
		path: ["data"],
	},
	INVALID_RESULT: {
		message: "Invalid Result: exactly one of 'data' or 'error' must be null",
		path: ["data", "error"],
	},
} as const satisfies Record<string, StandardSchemaV1.Issue>;
