/**
 * Extracts a readable error message from an unknown error value
 *
 * @param error - The unknown error to extract a message from
 * @returns A string representation of the error
 */
export function extractErrorMessage(error: unknown): string {
	// Handle Error instances
	if (error instanceof Error) {
		return error.message;
	}

	// Handle primitives
	if (typeof error === "string") return error;
	if (
		typeof error === "number" ||
		typeof error === "boolean" ||
		typeof error === "bigint"
	)
		return String(error);
	if (typeof error === "symbol") return error.toString();
	if (error === null) return "null";
	if (error === undefined) return "undefined";

	// Handle arrays
	if (Array.isArray(error)) return JSON.stringify(error);

	// Handle plain objects
	if (typeof error === "object") {
		const errorObj = error as Record<string, unknown>;

		// Check common error properties
		const messageProps = [
			"message",
			"error",
			"description",
			"title",
			"reason",
			"details",
		] as const;
		for (const prop of messageProps) {
			if (prop in errorObj && typeof errorObj[prop] === "string") {
				return errorObj[prop];
			}
		}

		// Fallback to JSON stringification
		try {
			return JSON.stringify(error);
		} catch {
			return String(error);
		}
	}

	// Final fallback
	return String(error);
}
