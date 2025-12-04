import type {
	DefaultError,
	MutationFunction,
	MutationKey,
	MutationOptions,
	QueryClient,
	QueryFunction,
	QueryKey,
	QueryObserverOptions,
} from "@tanstack/query-core";
import { Err, Ok, type Result, resolve } from "../result/index.js";

/**
 * Input options for defining a query.
 *
 * Extends TanStack Query's QueryObserverOptions but replaces queryFn with resultQueryFn.
 * This type represents the configuration for creating a query definition with both
 * reactive and imperative interfaces for data fetching.
 *
 * @template TQueryFnData - The type of data returned by the query function
 * @template TError - The type of error that can be thrown
 * @template TData - The type of data returned by the query (after select transform)
 * @template TQueryKey - The type of the query key
 */
export type DefineQueryInput<
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
	resultQueryFn: QueryFunction<Result<TQueryFnData, TError>, TQueryKey>;
};

/**
 * Output of defineQuery function.
 *
 * The query definition is directly callable and defaults to `ensure()` behavior,
 * which is recommended for most imperative use cases like preloaders.
 *
 * Provides both reactive and imperative interfaces for data fetching:
 * - `()` (callable): Same as `ensure()` - returns cached data if available, fetches if not
 * - `options`: Returns config for use with useQuery() or createQuery()
 * - `fetch()`: Always attempts to fetch data (from cache if fresh, network if stale)
 * - `ensure()`: Guarantees data availability, preferring cached data (recommended for preloaders)
 *
 * @template TQueryFnData - The type of data returned by the query function
 * @template TError - The type of error that can be thrown
 * @template TData - The type of data returned by the query (after select transform)
 * @template TQueryKey - The type of the query key
 *
 * @example
 * ```typescript
 * const userQuery = defineQuery({...});
 *
 * // Directly callable (same as .ensure())
 * const { data, error } = await userQuery();
 *
 * // Or use explicit methods
 * const { data, error } = await userQuery.ensure();
 * const { data, error } = await userQuery.fetch();
 *
 * // For reactive usage
 * const query = createQuery(userQuery.options);
 * ```
 */
export type DefineQueryOutput<
	TQueryFnData = unknown,
	TError = DefaultError,
	TData = TQueryFnData,
	TQueryData = TQueryFnData,
	TQueryKey extends QueryKey = QueryKey,
> = (() => Promise<Result<TQueryData, TError>>) & {
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
 * Input options for defining a mutation.
 *
 * Extends TanStack Query's MutationOptions but replaces mutationFn with resultMutationFn.
 * This type represents the configuration for creating a mutation definition with both
 * reactive and imperative interfaces for data mutations.
 *
 * @template TData - The type of data returned by the mutation
 * @template TError - The type of error that can be thrown
 * @template TVariables - The type of variables passed to the mutation
 * @template TContext - The type of context data for optimistic updates
 */
export type DefineMutationInput<
	TData,
	TError,
	TVariables = void,
	TContext = unknown,
> = Omit<MutationOptions<TData, TError, TVariables, TContext>, "mutationFn"> & {
	mutationKey: MutationKey;
	resultMutationFn: MutationFunction<Result<TData, TError>, TVariables>;
};

/**
 * Output of defineMutation function.
 *
 * The mutation definition is directly callable, which executes the mutation
 * and returns a Result. This is equivalent to calling `.execute()`.
 *
 * Provides both reactive and imperative interfaces for data mutations:
 * - `(variables)` (callable): Same as `execute()` - directly executes the mutation
 * - `options`: Returns config for use with useMutation() or createMutation()
 * - `execute(variables)`: Directly executes the mutation and returns a Result
 *
 * @template TData - The type of data returned by the mutation
 * @template TError - The type of error that can be thrown
 * @template TVariables - The type of variables passed to the mutation
 * @template TContext - The type of context data for optimistic updates
 *
 * @example
 * ```typescript
 * const createUser = defineMutation({...});
 *
 * // Directly callable (same as .execute())
 * const { data, error } = await createUser({ name: 'John' });
 *
 * // Or use explicit method
 * const { data, error } = await createUser.execute({ name: 'John' });
 *
 * // For reactive usage
 * const mutation = createMutation(createUser.options);
 * ```
 */
export type DefineMutationOutput<
	TData,
	TError,
	TVariables = void,
	TContext = unknown,
> = ((variables: TVariables) => Promise<Result<TData, TError>>) & {
	options: MutationOptions<TData, TError, TVariables, TContext>;
	execute: (variables: TVariables) => Promise<Result<TData, TError>>;
};

/**
 * Creates factory functions for defining queries and mutations bound to a specific QueryClient.
 *
 * This factory pattern allows you to create isolated query/mutation definitions that are
 * bound to a specific QueryClient instance, enabling:
 * - Multiple query clients in the same application
 * - Testing with isolated query clients
 * - Framework-agnostic query definitions
 * - Proper separation of concerns between query logic and client instances
 *
 * The returned functions handle Result types automatically, unwrapping them for TanStack Query
 * while maintaining type safety throughout your application.
 *
 * @param queryClient - The QueryClient instance to bind the factories to
 * @returns An object containing defineQuery and defineMutation functions bound to the provided client
 *
 * @example
 * ```typescript
 * // Create your query client
 * const queryClient = new QueryClient({
 *   defaultOptions: {
 *     queries: { staleTime: 5 * 60 * 1000 }
 *   }
 * });
 *
 * // Create the factory functions
 * const { defineQuery, defineMutation } = createQueryFactories(queryClient);
 *
 * // Now use defineQuery and defineMutation as before
 * const userQuery = defineQuery({
 *   queryKey: ['user', userId],
 *   resultQueryFn: () => services.getUser(userId)
 * });
 *
 * // Use in components
 * const query = createQuery(userQuery.options);
 *
 * // Or imperatively
 * const { data, error } = await userQuery.fetch();
 * ```
 */
export function createQueryFactories(queryClient: QueryClient) {
	/**
	 * Creates a query definition that bridges the gap between pure service functions and reactive UI components.
	 *
	 * This factory function is the cornerstone of our data fetching architecture. It wraps service calls
	 * with TanStack Query superpowers while maintaining type safety through Result types.
	 *
	 * The returned query definition is **directly callable** and defaults to `ensure()` behavior,
	 * which is recommended for most imperative use cases like preloaders.
	 *
	 * ## Why use defineQuery?
	 *
	 * 1. **Callable**: Call directly like `userQuery()` for imperative data fetching
	 * 2. **Dual Interface**: Also provides reactive (`.options`) and explicit imperative (`.fetch()`, `.ensure()`) APIs
	 * 3. **Automatic Error Handling**: Service functions return `Result<T, E>` types which are automatically
	 *    unwrapped by TanStack Query, giving you proper error states in your components
	 * 4. **Type Safety**: Full TypeScript support with proper inference for data and error types
	 * 5. **Consistency**: Every query in the app follows the same pattern, making it easy to understand
	 *
	 * @template TQueryFnData - The type of data returned by the query function
	 * @template TError - The type of error that can be thrown
	 * @template TData - The type of data returned by the query (after select transform)
	 * @template TQueryKey - The type of the query key
	 *
	 * @param options - Query configuration object
	 * @param options.queryKey - Unique key for this query (used for caching and refetching)
	 * @param options.resultQueryFn - Function that fetches data and returns a Result type
	 * @param options.* - Any other TanStack Query options (staleTime, refetchInterval, etc.)
	 *
	 * @returns Callable query definition with:
	 *   - `()` (callable): Same as `ensure()` - returns cached data if available, fetches if not
	 *   - `.options`: Config for use with useQuery() or createQuery()
	 *   - `.fetch()`: Always attempts to fetch (from cache if fresh, network if stale)
	 *   - `.ensure()`: Guarantees data availability, preferring cached data (recommended for preloaders)
	 *
	 * @example
	 * ```typescript
	 * // Step 1: Define your query in the query layer
	 * const userQuery = defineQuery({
	 *   queryKey: ['users', userId],
	 *   resultQueryFn: () => services.getUser(userId), // Returns Result<User, ApiError>
	 *   staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
	 * });
	 *
	 * // Step 2a: Use reactively in a Svelte component
	 * const query = createQuery(userQuery.options);
	 * // $query.data is User | undefined
	 * // $query.error is ApiError | null
	 *
	 * // Step 2b: Call directly in preloaders (recommended)
	 * export const load = async () => {
	 *   const { data, error } = await userQuery(); // Same as userQuery.ensure()
	 *   if (error) throw error;
	 *   return { user: data };
	 * };
	 *
	 * // Step 2c: Use explicit methods when needed
	 * async function refreshUser() {
	 *   const { data, error } = await userQuery.fetch(); // Force fresh fetch
	 *   if (error) {
	 *     console.error('Failed to fetch user:', error);
	 *   }
	 * }
	 * ```
	 */
	const defineQuery = <
		TQueryFnData = unknown,
		TError = DefaultError,
		TData = TQueryFnData,
		TQueryData = TQueryFnData,
		TQueryKey extends QueryKey = QueryKey,
	>(
		options: DefineQueryInput<
			TQueryFnData,
			TError,
			TData,
			TQueryData,
			TQueryKey
		>,
	): DefineQueryOutput<TQueryFnData, TError, TData, TQueryData, TQueryKey> => {
		const newOptions = {
			...options,
			queryFn: async (context) => {
				let result = options.resultQueryFn(context);
				if (result instanceof Promise) result = await result;
				return resolve(result);
			},
		} satisfies QueryObserverOptions<
			TQueryFnData,
			TError,
			TData,
			TQueryData,
			TQueryKey
		>;

		/**
		 * Fetches data for this query using queryClient.fetchQuery().
		 *
		 * This method ALWAYS evaluates freshness and will refetch if data is stale.
		 * It wraps TanStack Query's fetchQuery method, which returns cached data if fresh
		 * or makes a network request if the data is stale or missing.
		 *
		 * **When to use fetch():**
		 * - When you explicitly want to check data freshness
		 * - For user-triggered refresh actions
		 * - When you need the most up-to-date data
		 *
		 * **For preloaders, use ensure() instead** - it's more efficient for initial data loading.
		 *
		 * @returns Promise that resolves with a Result containing either the data or an error
		 *
		 * @example
		 * // Good for user-triggered refresh
		 * const { data, error } = await userQuery.fetch();
		 * if (error) {
		 *   console.error('Failed to load user:', error);
		 * }
		 */
		async function fetch(): Promise<Result<TQueryData, TError>> {
			try {
				return Ok(
					await queryClient.fetchQuery<
						TQueryFnData,
						TError,
						TQueryData,
						TQueryKey
					>({
						queryKey: newOptions.queryKey,
						queryFn: newOptions.queryFn,
					}),
				);
			} catch (error) {
				return Err(error as TError);
			}
		}

		/**
		 * Ensures data is available for this query using queryClient.ensureQueryData().
		 *
		 * This method PRIORITIZES cached data and only calls fetchQuery internally if no cached
		 * data exists. It wraps TanStack Query's ensureQueryData method, which is perfect for
		 * guaranteeing data availability with minimal network requests.
		 *
		 * **This is the RECOMMENDED method for preloaders** because:
		 * - It returns cached data immediately if available
		 * - It updates the query client cache properly
		 * - It minimizes network requests during navigation
		 * - It ensures components have data ready when they mount
		 *
		 * **When to use ensure():**
		 * - Route preloaders and data loading functions
		 * - Initial component data requirements
		 * - When cached data is acceptable for immediate display
		 *
		 * This is also the default behavior when calling the query directly.
		 *
		 * @returns Promise that resolves with a Result containing either the data or an error
		 *
		 * @example
		 * // Perfect for preloaders
		 * export const load = async () => {
		 *   const { data, error } = await userQuery.ensure();
		 *   // Or simply: await userQuery();
		 *   if (error) {
		 *     throw error;
		 *   }
		 *   return { user: data };
		 * };
		 */
		async function ensure(): Promise<Result<TQueryData, TError>> {
			try {
				return Ok(
					await queryClient.ensureQueryData<
						TQueryFnData,
						TError,
						TQueryData,
						TQueryKey
					>({
						queryKey: newOptions.queryKey,
						queryFn: newOptions.queryFn,
					}),
				);
			} catch (error) {
				return Err(error as TError);
			}
		}

		// Create a callable function that defaults to ensure() behavior
		// and attach options, fetch, and ensure as properties
		return Object.assign(ensure, {
			options: newOptions,
			fetch,
			ensure,
		});
	};

	/**
	 * Creates a mutation definition for operations that modify data (create, update, delete).
	 *
	 * This factory function is the mutation counterpart to defineQuery. It provides a clean way to
	 * wrap service functions that perform side effects, while maintaining the same dual interface
	 * pattern for maximum flexibility.
	 *
	 * The returned mutation definition is **directly callable**, which executes the mutation
	 * and returns a Result. This is equivalent to calling `.execute()`.
	 *
	 * ## Why use defineMutation?
	 *
	 * 1. **Callable**: Call directly like `createUser({ name: 'John' })` for imperative execution
	 * 2. **Dual Interface**: Also provides reactive (`.options`) and explicit imperative (`.execute()`) APIs
	 * 3. **Consistent Error Handling**: Service functions return `Result<T, E>` types, ensuring
	 *    errors are handled consistently throughout the app
	 * 4. **Cache Management**: Mutations often update the cache after success (see examples)
	 *
	 * @template TData - The type of data returned by the mutation
	 * @template TError - The type of error that can be thrown
	 * @template TVariables - The type of variables passed to the mutation
	 * @template TContext - The type of context data for optimistic updates
	 *
	 * @param options - Mutation configuration object
	 * @param options.mutationKey - Unique key for this mutation (used for tracking in-flight state)
	 * @param options.resultMutationFn - Function that performs the mutation and returns a Result type
	 * @param options.* - Any other TanStack Mutation options (onSuccess, onError, etc.)
	 *
	 * @returns Callable mutation definition with:
	 *   - `(variables)` (callable): Same as `execute()` - directly executes the mutation
	 *   - `.options`: Config for use with useMutation() or createMutation()
	 *   - `.execute(variables)`: Directly executes the mutation and returns a Result
	 *
	 * @example
	 * ```typescript
	 * // Step 1: Define your mutation with cache updates
	 * const createRecording = defineMutation({
	 *   mutationKey: ['recordings', 'create'],
	 *   resultMutationFn: async (recording: Recording) => {
	 *     // Call the service
	 *     const result = await services.db.createRecording(recording);
	 *     if (result.error) return Err(result.error);
	 *
	 *     // Update cache on success
	 *     queryClient.setQueryData(['recordings'], (old) =>
	 *       [...(old || []), recording]
	 *     );
	 *
	 *     return Ok(result.data);
	 *   }
	 * });
	 *
	 * // Step 2a: Use reactively in a component
	 * const mutation = createMutation(createRecording.options);
	 * // Call with: $mutation.mutate(recordingData)
	 *
	 * // Step 2b: Call directly in an action (recommended)
	 * async function saveRecording(data: Recording) {
	 *   const { error } = await createRecording(data); // Same as createRecording.execute(data)
	 *   if (error) {
	 *     notify.error({ title: 'Failed to save', description: error.message });
	 *   } else {
	 *     notify.success({ title: 'Recording saved!' });
	 *   }
	 * }
	 * ```
	 *
	 * @tip Calling directly is especially useful for:
	 * - Event handlers that need to await the result
	 * - Sequential operations that depend on each other
	 * - Non-component code that needs to trigger mutations
	 */
	const defineMutation = <TData, TError, TVariables = void, TContext = unknown>(
		options: DefineMutationInput<TData, TError, TVariables, TContext>,
	): DefineMutationOutput<TData, TError, TVariables, TContext> => {
		const newOptions = {
			...options,
			mutationFn: async (variables: TVariables) => {
				return resolve(await options.resultMutationFn(variables));
			},
		} satisfies MutationOptions<TData, TError, TVariables, TContext>;

		/**
		 * Executes the mutation imperatively and returns a Result.
		 *
		 * This is the recommended way to trigger mutations from:
		 * - Button click handlers
		 * - Form submissions
		 * - Keyboard shortcuts
		 * - Any non-component code
		 *
		 * The method automatically wraps the result in a Result type, so you always
		 * get back `{ data, error }` for consistent error handling.
		 *
		 * This is also the default behavior when calling the mutation directly.
		 *
		 * @param variables - The variables to pass to the mutation function
		 * @returns Promise that resolves with a Result containing either the data or an error
		 *
		 * @example
		 * // In an event handler
		 * async function handleSubmit(formData: FormData) {
		 *   const { data, error } = await createUser.execute(formData);
		 *   // Or simply: await createUser(formData);
		 *   if (error) {
		 *     notify.error({ title: 'Failed to create user', description: error.message });
		 *     return;
		 *   }
		 *   goto(`/users/${data.id}`);
		 * }
		 */
		async function execute(variables: TVariables) {
			try {
				return Ok(await runMutation(queryClient, newOptions, variables));
			} catch (error) {
				return Err(error as TError);
			}
		}

		// Create a callable function that executes the mutation
		// and attach options and execute as properties
		return Object.assign(execute, {
			options: newOptions,
			execute,
		});
	};

	return {
		defineQuery,
		defineMutation,
	};
}

/**
 * Internal helper that executes a mutation directly using the query client's mutation cache.
 *
 * This is what powers the callable behavior and `.execute()` method on mutations.
 * It bypasses the reactive mutation hooks and runs the mutation imperatively,
 * which is perfect for event handlers and other imperative code.
 *
 * @internal
 * @template TData - The type of data returned by the mutation
 * @template TError - The type of error that can be thrown
 * @template TVariables - The type of variables passed to the mutation
 * @template TContext - The type of context data
 * @param queryClient - The query client instance to use
 * @param options - The mutation options including mutationFn and mutationKey
 * @param variables - The variables to pass to the mutation function
 * @returns Promise that resolves with the mutation result
 */
function runMutation<TData, TError, TVariables, TContext>(
	queryClient: QueryClient,
	options: MutationOptions<TData, TError, TVariables, TContext>,
	variables: TVariables,
) {
	const mutation = queryClient.getMutationCache().build(queryClient, options);
	return mutation.execute(variables);
}
