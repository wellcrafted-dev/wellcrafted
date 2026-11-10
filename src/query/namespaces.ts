import type { MutationObserverOptions } from "@tanstack/query-core";
import type { Result } from "../result/index.js";
import {
	type ResultQueryOptions,
	resultMutationOptions,
	resultQueryOptions,
} from "./utils.js";

type ResultFn = (
	...args: never[]
) => Result<unknown, unknown> | Promise<Result<unknown, unknown>>;
// Exclude the impossible Err<never> branch before inspecting the discriminator.
// Structural Ok/Err matching alone also treats Err<never> as Ok<null>.
type ResultData<R> = R extends { error: never }
	? never
	: R extends { error: null; data: infer D }
		? D
		: never;
type ResultError<R> = R extends { error: null }
	? never
	: R extends { error: infer E }
		? E
		: never;
type ServiceData<F extends ResultFn> = ResultData<Awaited<ReturnType<F>>>;
type ServiceError<F extends ResultFn> = ResultError<Awaited<ReturnType<F>>>;
type MethodName<K> = `${K & (string | number)}`;

/** A query factory: the method's arguments in, native query options out. `.key` is the prefix shared by every argument variant. */
export type ResultQuery<
	N extends readonly string[],
	K extends string,
	F extends ResultFn,
> = ((
	...args: Parameters<F>
) => ResultQueryOptions<
	ServiceData<F>,
	ServiceError<F>,
	ServiceData<F>,
	ServiceData<F>,
	readonly [...N, K, Parameters<F>]
>) & { key: readonly [...N, K] };

/**
 * Turn Result-returning reads into query option factories keyed by
 * `[...namespace, method, args]`.
 *
 * Each factory takes the method's own arguments and returns plain TanStack
 * options. Add options for one use by spreading them, and policy for a method
 * or namespace with `client.setQueryDefaults(prefix, ...)`.
 * Maps own enumerable string properties; numeric names become strings.
 * Pass bound methods or closures, and annotate parameters of new wrappers.
 *
 * @example
 * ```ts
 * const users = resultQueries(['users'], { get: service.get, list: service.list });
 * createQuery(() => users.get('u1'));
 * createQuery(() => ({ ...users.list(), select: (all) => all.length }));
 * ```
 */
export function resultQueries<
	const N extends readonly string[],
	M extends Record<string, ResultFn>,
>(
	namespace: N,
	methods: M,
): { [K in keyof M & (string | number)]: ResultQuery<N, MethodName<K>, M[K]> } {
	return Object.fromEntries(
		Object.entries(methods).map(([name, method]) => {
			const key = [...namespace, name];
			const factory = (...args: never[]) =>
				resultQueryOptions({
					queryKey: [...key, args],
					queryFn: () => method(...args),
				});
			return [name, Object.assign(factory, { key })];
		}),
	) as never;
}

type Variables<F extends ResultFn> = Parameters<F> extends []
	? // biome-ignore lint/suspicious/noConfusingVoidType: TanStack void variables permit omitted mutation inputs.
		void
	: Parameters<F> extends [infer V]
		? V
		: Parameters<F> extends [(infer V)?]
			? // biome-ignore lint/suspicious/noConfusingVoidType: Optional service inputs use TanStack void variables.
				V | void
			: never;
type OneVariable<F extends ResultFn> = [Variables<F>] extends [never]
	? "resultMutations: a mutation takes zero or one variables argument; adapt it to one object"
	: F;

/** Native mutation options for one method, keyed `[...namespace, method]`. */
export type ResultMutation<
	N extends readonly string[],
	K extends string,
	F extends ResultFn,
> = MutationObserverOptions<
	ServiceData<F>,
	ServiceError<F>,
	Variables<F>,
	unknown
> & { mutationKey: readonly [...N, K] };

/**
 * Turn Result-returning writes into plain mutation options keyed by
 * `[...namespace, method]`.
 *
 * Each entry is the options object itself. Spread it to add callbacks, or put
 * policy in the client with `setMutationDefaults(prefix, ...)` or a
 * `MutationCache` rule. Only the variables reach the method.
 *
 * @example
 * ```ts
 * const write = resultMutations(['users'], { update: service.update });
 * createMutation(() => write.update);
 * await runMutation(client, write.update, { id: 'u1', name: 'Ada' });
 * ```
 */
export function resultMutations<
	const N extends readonly string[],
	M extends Record<string, ResultFn>,
>(
	namespace: N,
	methods: M & { [K in keyof M]: OneVariable<M[K]> },
): {
	[K in keyof M & (string | number)]: ResultMutation<N, MethodName<K>, M[K]>;
} {
	return Object.fromEntries(
		Object.entries(methods as Record<string, ResultFn>).map(
			([name, method]) => [
				name,
				resultMutationOptions({
					mutationKey: [...namespace, name],
					mutationFn: (variables: unknown) => method(variables as never),
				}),
			],
		),
	) as never;
}
