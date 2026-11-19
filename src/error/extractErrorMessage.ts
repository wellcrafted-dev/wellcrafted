const MESSAGE_PROPS = [
	"message",
	"error",
	"description",
	"title",
	"reason",
	"details",
] as const;

/**
 * Extracts a readable error message from an unknown error value
 *
 * Never throws: callers use it inside `catch` blocks, so a hostile value
 * (a throwing getter, a revoked Proxy, a cyclic array) falls back to
 * `String(error)` for an Error, JSON for anything else, then
 * `String(error)`, then `"[unprintable error]"`.
 *
 * @param error - The unknown error to extract a message from
 * @returns A string representation of the error
 */
export function extractErrorMessage(error: unknown): string {
	// Primitives: String() never throws for these, symbols included
	if (typeof error !== "object" && typeof error !== "function") {
		return String(error);
	}
	if (error === null) return "null";

	return (
		attempt(() => readMessage(error)) ??
		// An Error's own fields are not enumerable, so JSON would give "{}"
		attempt(() => (error instanceof Error ? String(error) : undefined)) ??
		attempt(() => JSON.stringify(error)) ??
		attempt(() => String(error)) ??
		"[unprintable error]"
	);
}

/** Returns the first string among the common message properties of a plain or Error object. */
function readMessage(error: object): string | undefined {
	if (typeof error !== "object" || Array.isArray(error)) return undefined;
	const errorObj = error as Record<string, unknown>;
	for (const prop of MESSAGE_PROPS) {
		if (!(prop in errorObj)) continue;
		const value = errorObj[prop];
		if (typeof value === "string") return value;
	}
	return undefined;
}

/** Runs `read`, turning a throw into `undefined` so the next fallback runs. */
function attempt(read: () => string | undefined): string | undefined {
	try {
		return read();
	} catch {
		return undefined;
	}
}
