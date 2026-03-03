import { Err } from "../result/result.js";
import type { DefineErrorsReturn, ErrorsConfig } from "./types.js";

/**
 * Defines a set of typed error factories from constructor functions.
 *
 * Each key must end in `Error` and maps to a constructor function that takes
 * input and returns `{ message, ...data }`. `defineErrors` stamps `name` from
 * the key and generates both a plain factory (`FooError`) and an `Err`-wrapped
 * factory (`FooErr`).
 *
 * @example
 * ```ts
 * const errors = defineErrors({
 *   ConnectionError: ({ cause }: { cause: string }) => ({
 *     message: `Failed to connect: ${cause}`,
 *     cause,
 *   }),
 *   RecorderBusyError: () => ({
 *     message: 'A recording is already in progress',
 *   }),
 * });
 *
 * const { ConnectionError, ConnectionErr, RecorderBusyError } = errors;
 * ```
 */
export function defineErrors<const TConfig extends ErrorsConfig>(
	config: TConfig,
): DefineErrorsReturn<TConfig> {
	const result: Record<string, unknown> = {};

	for (const [name, constructor] of Object.entries(config)) {
		const errName = name.replace(/Error$/, "Err");

		const factory = (...args: unknown[]) => {
			const body = (constructor as Function)(...args);
			return Object.freeze({ ...body, name });
		};

		result[name] = factory;
		result[errName] = (...args: unknown[]) => Err(factory(...args));
	}

	return result as DefineErrorsReturn<TConfig>;
}
