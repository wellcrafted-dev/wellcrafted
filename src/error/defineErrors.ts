import { Err } from "../result/result.js";
import type {
	DefineErrorsReturn,
	ErrorsConfig,
	ValidatedConfig,
} from "./types.js";

/**
 * Defines a set of typed error factories using Rust-style namespaced variants.
 *
 * Each key is a short variant name (the namespace provides context). Every
 * factory returns `Err<...>` directly — ready for `trySync`/`tryAsync` catch
 * handlers. The variant name is stamped as `name` on the error object.
 *
 * @example
 * ```ts
 * const HttpError = defineErrors({
 *   Connection: ({ cause }: { cause: string }) => ({
 *     message: `Failed to connect: ${cause}`,
 *     cause,
 *   }),
 *   Parse: ({ cause }: { cause: string }) => ({
 *     message: `Failed to parse: ${cause}`,
 *     cause,
 *   }),
 * });
 *
 * type HttpError = InferErrors<typeof HttpError>;
 *
 * const result = HttpError.Connection({ cause: 'timeout' }); // Err<...>
 * ```
 */
export function defineErrors<const TConfig extends ErrorsConfig>(
	config: TConfig & ValidatedConfig<TConfig>,
): DefineErrorsReturn<TConfig> {
	const result: Record<string, unknown> = {};

	for (const [name, ctor] of Object.entries(config)) {
		result[name] = (...args: unknown[]) => {
			const body = (ctor as (...a: unknown[]) => Record<string, unknown>)(
				...args,
			);
			return Err(Object.freeze({ ...body, name }));
		};
	}

	return result as DefineErrorsReturn<TConfig>;
}
