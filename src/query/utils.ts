import {
	type CancelledError,
	type DataTag,
	type DefaultError,
	type MutationFunctionContext,
	type MutationKey,
	MutationObserver,
	type MutationObserverOptions,
	type QueryClient,
	type QueryExecuteOptions,
	type QueryFunction,
	type QueryKey,
	type QueryObserverOptions,
} from "@tanstack/query-core";
import { Err, Ok, type Result, unwrap } from "../result/index.js";

/**
 * Input for `resultQueryOptions`.
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
type ResultQueryOptionsInput<
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
 * Output of `resultQueryOptions`: plain TanStack query options whose
 * `queryKey` is tagged with the data and error types, as TanStack's own
 * `queryOptions()` does. The tag lets `queryClient.getQueryData(options.queryKey)`
 * and `setQueryData` infer the cached type without a cast.
 */
type ResultQueryOptions<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
> = QueryObserverOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey> & {
	queryKey: DataTag<TQueryKey, TQueryFnData, TError>;
};

/**
 * Input for `resultMutationOptions`.
 *
 * Mirrors TanStack Query's `MutationObserverOptions` but expects `mutationFn`
 * to return a Wellcrafted `Result`. The Result is unwrapped into TanStack's
 * throwing data/error contract by `resultMutationOptions`. Like TanStack's
 * own `mutationFn`, it receives the mutation context, including the
 * `QueryClient` running the mutation.
 *
 * @template TData - The success type produced by `mutationFn`
 * @template TError - The error type carried by the Result
 * @template TVariables - The variables passed to `mutationFn`
 * @template TOnMutateResult - The value returned by `onMutate`
 * @template TMutationKey - The literal mutation key tuple
 */
type ResultMutationOptionsInput<
	TData,
	TError,
	TVariables = void,
	TOnMutateResult = unknown,
	TMutationKey extends MutationKey = MutationKey,
> = Omit<
	MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>,
	"mutationFn"
> & {
	mutationKey: TMutationKey;
	mutationFn: (
		variables: TVariables,
		context: MutationFunctionContext,
	) => Result<TData, TError> | Promise<Result<TData, TError>>;
};

/**
 * Adapter from a Result-returning query function to TanStack Query options.
 *
 * This is the single place where `Result<TQueryFnData, TError>` is converted
 * into TanStack's contract: `Ok(data)` resolves with `data`, `Err(error)`
 * throws `error` into the query error channel. The error type is inferred
 * from the Result, so hooks see a typed `error` without explicit generics.
 *
 * The output is ordinary TanStack options. Pass it to any API that accepts
 * query options: framework hooks, `useQueries`, or this
 * module's `runQuery`.
 *
 * ```ts
 * const todoQueries = {
 *   detail: (id: string) =>
 *     resultQueryOptions({
 *       queryKey: todoKeys.detail(id),
 *       queryFn: () => api.getTodo(id),
 *     }),
 * };
 *
 * const todo = createQuery(() => todoQueries.detail(id));
 * queryClient.getQueryData(todoQueries.detail(id).queryKey); // Todo | undefined
 * ```
 *
 * @param options - Result-aware query configuration
 * @returns TanStack query options with `queryFn` rewired to unwrap `Ok` and
 *   throw `Err`, and `queryKey` tagged with the data and error types
 */
export function resultQueryOptions<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryData = TQueryFnData,
	const TQueryKey extends QueryKey = QueryKey,
>(
	options: ResultQueryOptionsInput<
		TQueryFnData,
		TError,
		TData,
		TQueryData,
		TQueryKey
	>,
): ResultQueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey> {
	return {
		...options,
		queryFn: async (context) => unwrap(await options.queryFn(context)),
	} as ResultQueryOptions<TQueryFnData, TError, TData, TQueryData, TQueryKey>;
}

/**
 * Adapter from a Result-returning mutation function to TanStack Query options.
 *
 * This is the single place where `Result<TData, TError>` is converted into
 * TanStack's contract: `Ok(data)` resolves with `data`, `Err(error)` throws
 * `error` into the mutation error channel.
 *
 * `mutationFn` and the lifecycle callbacks receive TanStack's mutation
 * context. Use its `client` to invalidate queries, so the definition never
 * captures a `QueryClient` and works with whichever client runs it:
 *
 * ```ts
 * const addTodo = resultMutationOptions({
 *   mutationKey: ['todos', 'add'],
 *   mutationFn: (title: string) => api.addTodo(title),
 *   onSuccess: (_data, _title, _onMutateResult, { client }) =>
 *     client.invalidateQueries({ queryKey: todoKeys.all }),
 * });
 *
 * const add = createMutation(() => addTodo);
 * ```
 *
 * @param options - Result-aware mutation configuration
 * @returns TanStack mutation options with `mutationFn` rewired to unwrap
 *   `Ok` and throw `Err`
 */
export function resultMutationOptions<
	TData,
	TError,
	TVariables = void,
	TOnMutateResult = unknown,
	const TMutationKey extends MutationKey = MutationKey,
>(
	options: ResultMutationOptionsInput<
		TData,
		TError,
		TVariables,
		TOnMutateResult,
		TMutationKey
	>,
): MutationObserverOptions<TData, TError, TVariables, TOnMutateResult> {
	return {
		...options,
		mutationFn: async (variables, context) =>
			unwrap(await options.mutationFn(variables, context)),
	} satisfies MutationObserverOptions<
		TData,
		TError,
		TVariables,
		TOnMutateResult
	>;
}

/**
 * Runs a query through `client` and returns a Result instead of throwing.
 *
 * Wraps `client.query`, TanStack's imperative read: fresh cached data is
 * returned without a request, stale or missing data is fetched, and an
 * in-flight request for the same key is shared. The result lands in the
 * cache, so every observer of the query sees it. `staleTime` decides what
 * counts as fresh; pass `staleTime: 'static'` to accept any cached data and
 * fetch only when the cache is empty.
 *
 * The error side includes TanStack's `CancelledError`, which the call
 * rejects with when the query is cancelled or the client is cleared while it
 * is in flight. Check it with `error instanceof CancelledError`, importing the
 * class from `@tanstack/query-core`.
 *
 * ```ts
 * const { data, error } = await runQuery(queryClient, todoQueries.detail(id));
 * if (error) return report(error);
 *
 * // Any cached data is fine; fetch only if there is none.
 * await runQuery(queryClient, { ...todoQueries.detail(id), staleTime: 'static' });
 * ```
 *
 * @param client - The `QueryClient` whose cache the query reads and writes
 * @param options - Query options, usually from `resultQueryOptions`
 */
export async function runQuery<
	TQueryFnData,
	TError,
	TData,
	TQueryData,
	TQueryKey extends QueryKey,
>(
	client: QueryClient,
	options: QueryExecuteOptions<
		TQueryFnData,
		TError,
		TData,
		TQueryData,
		TQueryKey
	>,
): Promise<Result<TData, TError | CancelledError>> {
	try {
		return Ok(await client.query(options));
	} catch (error) {
		return Err(error as TError | CancelledError);
	}
}

/**
 * Runs a mutation through `client` and returns a Result instead of throwing.
 *
 * Calling `mutationFn` directly would skip the mutation cache. Running it
 * through the client keeps the parts that other code depends on: the
 * definition's `onSuccess`/`onError`/`onSettled` callbacks (and with them any
 * invalidation), `useIsMutating` and `useMutationState`, mutation scopes, and
 * devtools. It uses a `MutationObserver`, TanStack's public way to run a
 * mutation outside a hook, and detaches it afterwards so the finished
 * mutation is garbage collected after `gcTime`.
 *
 * ```ts
 * const { error } = await runMutation(queryClient, addTodo, 'Buy milk');
 * ```
 *
 * @param client - The `QueryClient` whose mutation cache runs the mutation
 * @param options - Mutation options, usually from `resultMutationOptions`
 * @param variables - The variables passed to `mutationFn`
 */
export async function runMutation<TData, TError, TVariables, TOnMutateResult>(
	client: QueryClient,
	options: MutationObserverOptions<TData, TError, TVariables, TOnMutateResult>,
	variables: TVariables,
): Promise<Result<TData, TError>> {
	const observer = new MutationObserver(client, options);
	try {
		return Ok(await observer.mutate(variables));
	} catch (error) {
		return Err(error as TError);
	} finally {
		observer.reset();
	}
}
