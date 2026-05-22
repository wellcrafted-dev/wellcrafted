import { extractErrorMessage } from "./error/index.js";
import { isErr, isOk, type Result } from "./result/index.js";

/**
 * Test-only assertion helpers for `Result` values.
 *
 * These helpers intentionally **throw**. A failed expectation should abort the
 * test, and every test runner reports a thrown error as a failure. Tests are
 * the one place throwing is the correct control flow, so these are fenced into
 * the `wellcrafted/testing` entry point and kept out of `wellcrafted/result`,
 * which stays throw-free. Importing from `wellcrafted/testing` in production
 * code is a smell worth linting against.
 *
 * They are framework-agnostic: they throw a plain `Error` rather than calling
 * into a specific runner, so they work under bun, vitest, jest, or
 * `node:test`.
 */

/**
 * Asserts that `result` is `Ok` and returns its `data`.
 *
 * Throws if `result` is `Err`. The returned value is narrowed to the success
 * type, so no optional chaining or casting is needed at the call site.
 *
 * @example
 * ```ts
 * import { expectOk } from "wellcrafted/testing";
 *
 * const value = expectOk(parseConfig(raw)); // typed as the success value
 * ```
 */
export function expectOk<T>(result: Result<T, unknown>): T {
	if (!isOk(result)) {
		throw new Error(
			`Expected Ok, but got Err: ${extractErrorMessage(result.error)}`,
		);
	}
	return result.data;
}

/**
 * Asserts that `result` is `Err` and returns its `error`.
 *
 * Throws if `result` is `Ok`. The returned value is narrowed to the error
 * type, so no optional chaining or casting is needed at the call site.
 *
 * @example
 * ```ts
 * import { expectErr } from "wellcrafted/testing";
 *
 * const error = expectErr(parseConfig("not valid"));
 * expect(error.name).toBe("ConfigParseError");
 * ```
 */
export function expectErr<E>(result: Result<unknown, E>): E {
	if (!isErr(result)) {
		throw new Error("Expected Err, but got Ok");
	}
	return result.error;
}
