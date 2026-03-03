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
