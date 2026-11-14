export function assert(condition: unknown, message: string): asserts condition {
	if (condition) return;
	throw new Error(message);
}

export function assertEqual(actual: unknown, expected: unknown): void {
	const actualJson = JSON.stringify(actual);
	const expectedJson = JSON.stringify(expected);
	assert(
		actualJson === expectedJson,
		`Expected ${expectedJson}, received ${actualJson}`,
	);
}
