export const ERRORS = {
	EXPECTED_OBJECT: "Expected object",
	EXPECTED_DATA_ERROR_PROPS:
		"Expected object with 'data' and 'error' properties",
	EXPECTED_ERROR_NULL: "Expected 'error' to be null for Ok variant",
	EXPECTED_DATA_NULL: "Expected 'data' to be null for Err variant",
	INVALID_RESULT:
		"Invalid Result: exactly one of 'data' or 'error' must be null",
} as const;
