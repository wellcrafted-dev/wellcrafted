import type {
	DefaultError,
	MutationKey,
	MutationObserverOptions,
	MutationOptions,
	QueryClient,
	QueryFunction,
	QueryKey,
	QueryObserverOptions,
} from "@tanstack/query-core";
import { Err, Ok, type Result, resolve } from "../result/index.js";

/**
 * Input for `resultQueryOptions` and `defineQuery`.
 *
 * Mirrors TanStack Query's `QueryObserverOptions` but expects `queryFn` to
 * return a Wellcrafted `Result`. The Result is unwrapped into TanStack's
 * throwing data/error contract by `resultQueryOptions`.
 *
 * @template TQueryFnData - The success type produced by `queryFn`
 * @template TError - The error type carried by the Result
 * @template TData - The type seen by consumers after `select`
 * @template TQueryData - The type stored in the cache (usually `TQueryFnData`)
 * @template TQueryKey - The literal query key tuple
 */
type QueryOptionsInput<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
> = Omit<
	QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
	"queryFn"
> & {
	queryKey: TQueryKey;
	queryFn: QueryFunction<Result<TQueryFnData, TError>, TQueryKey>;
};

/**
 * Input for `resultMutationOptions` and `defineMutation`.
 *
 * Mirrors TanStack Query's `MutationObserverOptions` but expects `mutationFn`
 * to return a Wellcrafted `Result`. The Result is unwrapped into TanStack's
 * throwing data/error contract by `resultMutationOptions`.
 *
 * @template TData - The success type produced by `mutationFn`
 * @template TError - The error type carried by the Result
 * @template TVariables - The variables passed to `mutationFn`
 * @template TContext - The context type for optimistic updates
 * @template TMutationKey - The literal mutation key tuple
 */
type MutationOptionsInput<
	TData,
	TError,
	TVariables = void,
	TContext = unknown,
	TMutationKey extends MutationKey = MutationKey,
> = Omit<
	MutationObserverOptions<TData, TError, TVariables, TContext>,
	"mutationFn"
> & {
	mutationKey: TMutationKey;
	mutationFn: (
		variables: TVariables,
	) => Result<TData, TError> | Promise<Result<TData, TError>>;
};

/**
 * Adapter from a Result-returning query function to TanStack Query options.
 *
 * This is the single canonical place where `Result<TQueryFnData, TError>`
 * is converted into TanStack's contract: `Ok(data)` resolves with `data`,
 * `Err(error)` throws `error` into the query error channel.
 *
 * Use this directly with framework hooks when you do not need the
 * `QueryClient`-bound imperative helpers from `defineQuery`:
 *
 * ```ts
 * const query = createQuery(() => resultQueryOptions({
 *   queryKey: ['user', userId],
 *   queryFn: () => services.getUser(userId),
 * }));
 * ```
 *
 * `defineQuery` composes through this helper, so the `.options` it returns
 * is the same shape `resultQueryOptions` produces.
 *
 * @param input - Result-aware query configuration
 * @returns TanStack Query `QueryObserverOptions` with `queryFn` rewired to
 *   resolve `Ok` and throw `Err`
 */
export function resultQueryOptions<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryData = TQueryFnData,
	const TQueryKey extends QueryKey = QueryKey,
>(
	input: QueryOptionsInput<TQueryFnData, TError, TData, TQueryData, TQueryKey>,
): QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey> {
	return {
		...input,
		queryFn: async (context) => resolve(await input.queryFn(context)),
	} satisfies QueryObserverOptions<
		TQueryFnData,
		TError,
		TData,
		TQueryData,
		TQueryKey
	>;
}

/**
 * Adapter from a Result-returning mutation function to TanStack Query options.
 *
 * This is the single canonical place where `Result<TData, TError>` is
 * converted into TanStack's contract: `Ok(data)` resolves with `data`,
 * `Err(error)` throws `error` into the mutation error channel.
 *
 * Use this directly with framework hooks when you do not need the
 * `QueryClient`-bound imperative helpers from `defineMutation`:
 *
 * ```ts
 * const save = createMutation(() => resultMutationOptions({
 *   mutationKey: ['saveUser'],
 *   mutationFn: (input: SaveUserInput) => services.saveUser(input),
 * }));
 * ```
 *
 * `defineMutation` composes through this helper, so the `.options` it
 * returns is the same shape `resultMutationOptions` produces.
 *
 * @param input - Result-aware mutation configuration
 * @returns TanStack Query `MutationObserverOptions` with `mutationFn` rewired
 *   to resolve `Ok` and throw `Err`
 */
export function resultMutationOptions<
	TData,
	TError,
	TVariables = void,
	TContext = unknown,
	const TMutationKey extends MutationKey = MutationKey,
>(
	input: MutationOptionsInput<
		TData,
		TError,
		TVariables,
		TContext,
		TMutationKey
	>,
): MutationObserverOptions<TData, TError, TVariables, TContext> {
	return {
		...input,
		mutationFn: async (variables: TVariables) =>
			resolve(await input.mutationFn(variables)),
	} satisfies MutationObserverOptions<TData, TError, TVariables, TContext>;
}

/**
 * Output of `defineQuery`.
 *
 * Query imperative reads require an explicit cache policy.
 *
 * - `options`: Options shape produced by `resultQueryOptions`, ready for hooks.
 * - `fetch()`: Always evaluates freshness; refetches if stale.
 * - `ensure()`: Prefers cached data; fetches only when missing.
 */
type DefineQueryOutput<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
> = {
	options: QueryObserverOptions<
		TQueryFnData,
		TError,
		TData,
		TQueryData,
		TQueryKey
	>;
	fetch: () => Promise<Result<TQueryData, TError>>;
	ensure: () => Promise<Result<TQueryData, TError>>;
};

/**
 * Output of `defineMutation`.
 *
 * The returned function directly executes the mutation.
 *
 * - `(variables)` (callable): Imperatively runs the mutation, returning a Result.
 * - `options`: Options shape produced by `resultMutationOptions`, ready for hooks.
 */
type DefineMutationOutput<
	TData,
	TError,
	TVariables = void,
	TContext = unknown,
> = ((variables: TVariables) => Promise<Result<TData, TError>>) & {
	options: MutationObserverOptions<TData, TError, TVariables, TContext>;
};

/**
 * Creates `defineQuery` and `defineMutation` bound to a specific `QueryClient`.
 *
 * Use this when you want a reusable query/mutation definition that carries
 * its own imperative query helpers (`.fetch`, `.ensure`) and callable mutation
 * execution powered by a specific client. For local one-shot options that only need
 * to flow into a framework hook, prefer `resultQueryOptions` / `resultMutationOptions`
 * directly: those are platform-agnostic and do not require a `QueryClient`.
 *
 * Both `defineQuery` and `defineMutation` compose through `resultQueryOptions` and
 * `resultMutationOptions`, so there is exactly one place that unwraps `Result`
 * into TanStack's throwing contract.
 *
 * @param queryClient - The TanStack `QueryClient` to bind imperative helpers to
 *
 * @example
 * ```ts
 * const queryClient = new QueryClient();
 * const { defineQuery, defineMutation } = createQueryFactories(queryClient);
 *
 * const userQuery = defineQuery({
 *   queryKey: ['user', userId],
 *   queryFn: () => services.getUser(userId),
 * });
 *
 * // Reactive
 * const query = createQuery(() => userQuery.options);
 *
 * // Imperative
 * const { data, error } = await userQuery.fetch();
 * ```
 */
export function createQueryFactories(queryClient: QueryClient) {
	const defineQuery = <
		TQueryFnData = unknown,
		TError = DefaultError,
		TData = TQueryFnData,
		TQueryData = TQueryFnData,
		const TQueryKey extends QueryKey = QueryKey,
	>(
		input: QueryOptionsInput<
			TQueryFnData,
			TError,
			TData,
			TQueryData,
			TQueryKey
		>,
	): DefineQueryOutput<TQueryFnData, TError, TData, TQueryData, TQueryKey> => {
		const options = resultQueryOptions(input);

		async function fetch(): Promise<Result<TQueryData, TError>> {
			try {
				return Ok(
					await queryClient.fetchQuery<
						TQueryFnData,
						TError,
						TQueryData,
						TQueryKey
					>(options),
				);
			} catch (error) {
				return Err(error as TError);
			}
		}

		async function ensure(): Promise<Result<TQueryData, TError>> {
			try {
				return Ok(
					await queryClient.ensureQueryData<
						TQueryFnData,
						TError,
						TQueryData,
						TQueryKey
					>(options),
				);
			} catch (error) {
				return Err(error as TError);
			}
		}

		return {
			options,
			fetch,
			ensure,
		};
	};

	const defineMutation = <
		TData,
		TError,
		TVariables = void,
		TContext = unknown,
		const TMutationKey extends MutationKey = MutationKey,
	>(
		input: MutationOptionsInput<
			TData,
			TError,
			TVariables,
			TContext,
			TMutationKey
		>,
	): DefineMutationOutput<TData, TError, TVariables, TContext> => {
		const options = resultMutationOptions(input);

		async function run(variables: TVariables) {
			try {
				return Ok(await runMutation(queryClient, options, variables));
			} catch (error) {
				return Err(error as TError);
			}
		}

		return Object.assign(run, {
			options,
		});
	};

	return {
		defineQuery,
		defineMutation,
	};
}

/**
 * Internal helper that executes a mutation directly using the query client's
 * mutation cache. Powers the callable behavior on mutations returned from
 * `defineMutation`.
 *
 * @internal
 */
function runMutation<TData, TError, TVariables, TContext>(
	queryClient: QueryClient,
	options: MutationOptions<TData, TError, TVariables, TContext>,
	variables: TVariables,
) {
	const mutation = queryClient.getMutationCache().build(queryClient, options);
	return mutation.execute(variables);
}

/**
 * Identity helper for declaring a TanStack Query key map while preserving
 * tuple types.
 *
 * - **Static entries** like `['users', 'active']` are narrowed to readonly
 *   tuples with full literal precision (e.g. `readonly ['users', 'active']`)
 *   via the `const` type parameter modifier. No per-line `as const` needed.
 *
 * - **Factory entries** like `(id: string) => ['users', id]` are narrowed to
 *   tuple SHAPE (e.g. `[string, string]` with correct arity), not widened to
 *   `string[]`. This happens because the strict tuple constraint provides
 *   contextual typing into the function body. Literal positions still widen
 *   without `as const` (TS does not propagate literal narrowing through
 *   contextual typing). Add `as const` to the body when you need the literal:
 *   `(id) => ['users', id] as const` -> `readonly ['users', string]`.
 *
 * Empty arrays and non-key values are rejected at the type level.
 *
 * @example
 * ```ts
 * const userKeys = defineKeys({
 *   all: ['users'],                          // readonly ['users']
 *   active: ['users', 'active'],             // readonly ['users', 'active']
 *   detail: (id: string) => ['users', id],   // [string, string] (tuple shape kept)
 *   page: (n: number) => ['users', n] as const, // readonly ['users', number]
 * });
 * ```
 */
export function defineKeys<
	const TKeys extends Record<
		string,
		| readonly [unknown, ...unknown[]]
		| ((...args: never[]) => readonly [unknown, ...unknown[]])
	>,
>(keys: TKeys): TKeys {
	return keys;
}
