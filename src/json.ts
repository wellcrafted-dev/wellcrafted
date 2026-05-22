import {
	defineErrors,
	extractErrorMessage,
	type InferError,
} from "./error/index.js";
import { type Result, trySync } from "./result/index.js";

/**
 * JSON-serializable value types.
 * Ensures data can be safely serialized via JSON.stringify.
 *
 * @example
 * ```typescript
 * import type { JsonValue, JsonObject } from "wellcrafted/json";
 *
 * const value: JsonValue = { key: [1, "two", true, null] };
 * const obj: JsonObject = { name: "Alice", age: 30 };
 * ```
 */
export type JsonValue =
	| string
	| number
	| boolean
	| null
	| JsonValue[]
	| { [key: string]: JsonValue };

/**
 * JSON-serializable object type.
 * A record where every value is a {@link JsonValue}.
 */
export type JsonObject = Record<string, JsonValue>;

// =============================================================================
// Parsing
// =============================================================================

/**
 * Constructs a {@link JsonParseError}. Returns `Err<JsonParseError>` directly,
 * ready to return from a `trySync`/`tryAsync` catch handler.
 */
export const { JsonParseError } = defineErrors({
	JsonParseError: ({ cause }: { cause: unknown }) => ({
		message: `Failed to parse JSON: ${extractErrorMessage(cause)}`,
		cause,
	}),
});

/**
 * The error {@link parseJson} produces when its input is not valid JSON.
 *
 * JSON parsing has exactly one failure mode (the engine throws a `SyntaxError`),
 * so this is a single variant. A valid-JSON-but-wrong-shape value is not a
 * parse failure: validate the returned {@link JsonValue} against a schema for
 * that case.
 */
export type JsonParseError = InferError<typeof JsonParseError>;

/**
 * Parses a JSON string into a {@link JsonValue}, returning a `Result` instead
 * of throwing.
 *
 * Unlike `JSON.parse`, which returns `any` and throws on malformed input, this:
 * - types the success value as {@link JsonValue}, forcing you to narrow or
 *   validate before treating it as a known shape
 * - reports failure as a tagged {@link JsonParseError} rather than an exception
 *
 * No reviver argument is accepted. A reviver can return arbitrary values, which
 * would make the {@link JsonValue} success type a lie.
 *
 * @param text - The JSON string to parse.
 * @returns `Ok<JsonValue>` on success, `Err<JsonParseError>` on malformed input.
 *
 * @example
 * ```ts
 * import { parseJson } from "wellcrafted/json";
 *
 * const { data, error } = parseJson('{"count":1}');
 * if (error) {
 *   console.error(error.message); // "Failed to parse JSON: ..."
 * } else {
 *   data; // JsonValue — narrow or validate before using
 * }
 * ```
 */
export function parseJson(text: string): Result<JsonValue, JsonParseError> {
	return trySync({
		try: () => JSON.parse(text) as JsonValue,
		catch: (cause) => JsonParseError({ cause }),
	});
}
