import type {
	MutationObserverOptions,
	QueryObserverOptions,
} from "@tanstack/query-core";
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
type QueryKeyFor<
	N extends readonly string[],
	K extends string,
	F extends ResultFn,
> = readonly [...N, K, Parameters<F>];
type SelectedData<S, D> = S extends (...args: never[]) => infer R ? R : D;
type QueryDefinition<
	N extends readonly string[],
	K extends string,
	F extends ResultFn,
> =
	| F
	| (Omit<
			QueryObserverOptions<
				ServiceData<F>,
				ServiceError<F>,
				unknown,
				ServiceData<F>,
				QueryKeyFor<N, K, F>
			>,
			"queryKey" | "queryHash" | "queryFn"
	  > & { queryFn: F; queryKey?: never; queryHash?: never });
type QueryFactory<
	N extends readonly string[],
	K extends string,
	F extends ResultFn,
	TData,
> = ((
	...args: Parameters<F>
) => ResultQueryOptions<
	ServiceData<F>,
	ServiceError<F>,
	TData,
	ServiceData<F>,
	QueryKeyFor<N, K, F>
>) & {
	key: readonly [...N, K];
};

/**
 * Select service reads to share native query options and cache keys.
 * Maps own enumerable string properties; numeric property names become strings.
 * Pass bound methods or closures, and annotate parameters of new service wrappers.
 *
 * @example
 * ```ts
 * const queries = createQueries(['users'], { getUser: service.getUser });
 * await runQuery(client, queries.getUser('u1'));
 * ```
 */
export function createQueries<
	const TNamespace extends readonly string[],
	TServices extends Record<string, ResultFn>,
	TSelect extends Record<string, unknown>,
>(
	namespace: TNamespace,
	definitions: {
		[K in keyof TServices]: QueryDefinition<
			TNamespace,
			MethodName<K>,
			TServices[K]
		>;
	} & {
		[K in keyof TSelect]: { queryFn: ResultFn; select?: TSelect[K] } | ResultFn;
	},
): {
	[K in keyof TServices & (string | number)]: QueryFactory<
		TNamespace,
		MethodName<K>,
		TServices[K],
		SelectedData<TSelect[MethodName<K>], ServiceData<TServices[K]>>
	>;
} {
	const entries = definitions as Record<
		string,
		ResultFn | ({ queryFn: ResultFn } & Record<string, unknown>)
	>;
	return Object.fromEntries<unknown>(
		Object.entries(entries).map(([name, definition]) => {
			const { queryFn: service, ...options } =
				typeof definition === "function" ? { queryFn: definition } : definition;
			const key = [...namespace, name];
			return [
				name,
				Object.assign(
					(...args: unknown[]) =>
						resultQueryOptions({
							...options,
							queryKey: [...key, args],
							// Identity always comes from the generated key, including for JavaScript callers.
							queryHash: undefined,
							queryFn: () => service(...(args as never[])),
						}),
					{ key },
				),
			];
		}),
	) as {
		[K in keyof TServices & (string | number)]: QueryFactory<
			TNamespace,
			MethodName<K>,
			TServices[K],
			SelectedData<TSelect[MethodName<K>], ServiceData<TServices[K]>>
		>;
	};
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
type OnMutateResult<M> = M extends (...args: never[]) => infer R
	? Awaited<R>
	: unknown;
type MutationDefinition<F extends ResultFn, R> = [Variables<F>] extends [never]
	? "createMutations: a mutation service takes zero or one variables argument; adapt it to one object explicitly"
	:
			| F
			| (Omit<
					MutationObserverOptions<
						ServiceData<F>,
						ServiceError<F>,
						Variables<F>,
						R
					>,
					"mutationFn" | "mutationKey"
			  > & { mutationFn: F; mutationKey?: never });
type MutationFactory<
	N extends readonly string[],
	K extends string,
	F extends ResultFn,
	R,
> = (() => MutationObserverOptions<
	ServiceData<F>,
	ServiceError<F>,
	Variables<F>,
	R
> & {
	mutationKey: readonly [...N, K];
}) & { key: readonly [...N, K] };

/**
 * Select service writes to share native mutation options and lifecycle policy.
 * Maps own enumerable string properties; numeric property names become strings.
 * To infer rollback data across callbacks, annotate every parameter declared by
 * `onMutate`, or use `resultMutationOptions` for full contextual inference.
 *
 * @example
 * ```ts
 * const mutations = createMutations(['users'], { update: service.update });
 * await runMutation(client, mutations.update(), { id: 'u1', name: 'Ada' });
 * ```
 */
export function createMutations<
	const TNamespace extends readonly string[],
	TServices extends Record<string, ResultFn>,
	TOnMutate extends Record<string, unknown>,
>(
	namespace: TNamespace,
	definitions: {
		[K in keyof TServices]: MutationDefinition<
			TServices[K],
			OnMutateResult<TOnMutate[MethodName<K>]>
		>;
	} & {
		[K in keyof TOnMutate]:
			| { mutationFn: ResultFn; onMutate?: TOnMutate[K] }
			| ResultFn;
	},
): {
	[K in keyof TServices & (string | number)]: MutationFactory<
		TNamespace,
		MethodName<K>,
		TServices[K],
		OnMutateResult<TOnMutate[MethodName<K>]>
	>;
} {
	const entries = definitions as Record<
		string,
		ResultFn | ({ mutationFn: ResultFn } & Record<string, unknown>)
	>;
	return Object.fromEntries<unknown>(
		Object.entries(entries).map(([name, definition]) => {
			const { mutationFn: service, ...options } =
				typeof definition === "function"
					? { mutationFn: definition }
					: definition;
			const mutationKey = [...namespace, name];
			return [
				name,
				Object.assign(
					() =>
						resultMutationOptions({
							...options,
							mutationKey,
							mutationFn: (variables: unknown) => service(variables as never),
						}),
					{ key: mutationKey },
				),
			];
		}),
	) as {
		[K in keyof TServices & (string | number)]: MutationFactory<
			TNamespace,
			MethodName<K>,
			TServices[K],
			OnMutateResult<TOnMutate[MethodName<K>]>
		>;
	};
}
