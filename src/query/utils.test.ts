import { describe, expect, expectTypeOf, it } from "bun:test";
import {
	CancelledError,
	type dataTagErrorSymbol,
	type MutationFunctionContext,
	QueryClient,
} from "@tanstack/query-core";
import { Err, Ok, type Result } from "../result/index.js";
import {
	resultMutationOptions,
	resultQueryOptions,
	runMutation,
	runQuery,
} from "./utils.js";

function queryContext(queryKey: readonly unknown[]) {
	return {
		queryKey,
		signal: new AbortController().signal,
		meta: undefined,
	};
}

function mutationContext(client: QueryClient): MutationFunctionContext {
	return { client, meta: undefined };
}

describe("resultQueryOptions", () => {
	it("infers literal queryKey tuple without `as const`", () => {
		resultQueryOptions({
			queryKey: ["users", "user-123"],
			queryFn: ({ queryKey }) => {
				expectTypeOf(queryKey).toEqualTypeOf<readonly ["users", "user-123"]>();
				return Ok({ id: queryKey[1] });
			},
		});
	});

	it("tags queryKey so cache reads infer the data type", () => {
		const client = new QueryClient();
		const options = resultQueryOptions({
			queryKey: ["session"],
			queryFn: () => Ok({ userId: "u1" }),
		});

		expectTypeOf(client.getQueryData(options.queryKey)).toEqualTypeOf<
			{ userId: string } | undefined
		>();
	});

	it("infers the error type from the Result", () => {
		type AuthError = { code: "UNAUTHORIZED"; message: string };

		const options = resultQueryOptions({
			queryKey: ["session"],
			queryFn: (): Result<{ userId: string }, AuthError> =>
				Ok({ userId: "u1" }),
		});

		expectTypeOf<
			(typeof options.queryKey)[typeof dataTagErrorSymbol]
		>().toEqualTypeOf<AuthError>();
	});

	it("resolves Ok values into the TanStack data channel", async () => {
		const options = resultQueryOptions({
			queryKey: ["ok"],
			queryFn: () => Ok(42),
		});

		const queryFn = options.queryFn as (ctx: unknown) => Promise<number>;
		expect(await queryFn(queryContext(["ok"]))).toBe(42);
	});

	it("throws Err values into the TanStack error channel", async () => {
		const options = resultQueryOptions({
			queryKey: ["err"],
			queryFn: () => Err("boom"),
		});

		const queryFn = options.queryFn as (ctx: unknown) => Promise<unknown>;
		expect(queryFn(queryContext(["err"]))).rejects.toBe("boom");
	});

	it("supports async Result-returning queryFn", async () => {
		const options = resultQueryOptions({
			queryKey: ["async"],
			queryFn: async () => Ok("async-data"),
		});

		const queryFn = options.queryFn as (ctx: unknown) => Promise<string>;
		expect(await queryFn(queryContext(["async"]))).toBe("async-data");
	});
});

describe("resultMutationOptions", () => {
	it("infers variables, data, and error from mutationFn", async () => {
		type SaveError = { code: "CONFLICT"; message: string };
		const client = new QueryClient();

		const options = resultMutationOptions({
			mutationKey: ["users", "create"],
			mutationFn: (input: {
				name: string;
			}): Result<{ id: string; name: string }, SaveError> =>
				Ok({ id: "u1", name: input.name }),
			throwOnError: (error) => {
				expectTypeOf(error).toEqualTypeOf<SaveError>();
				return false;
			},
		});

		const data = await options.mutationFn?.(
			{ name: "ada" },
			mutationContext(client),
		);
		expectTypeOf(data).toEqualTypeOf<
			{ id: string; name: string } | undefined
		>();
		expect(data).toEqual({ id: "u1", name: "ada" });
	});

	it("passes the mutation context to mutationFn", async () => {
		const client = new QueryClient();
		let received: QueryClient | undefined;

		const options = resultMutationOptions({
			mutationKey: ["context"],
			mutationFn: (_: undefined, { client }) => {
				received = client;
				return Ok(null);
			},
		});

		await options.mutationFn?.(undefined, mutationContext(client));
		expect(received).toBe(client);
	});

	it("throws Err values into the TanStack error channel", async () => {
		const client = new QueryClient();
		const options = resultMutationOptions({
			mutationKey: ["m-err"],
			mutationFn: async () => Err("fail"),
		});

		expect(
			options.mutationFn?.(undefined, mutationContext(client)),
		).rejects.toBe("fail");
	});
});

describe("runQuery", () => {
	it("returns Ok with the data and writes it to the cache", async () => {
		const client = new QueryClient();
		const options = resultQueryOptions({
			queryKey: ["users", "u1"],
			queryFn: () => Ok({ id: "u1" }),
		});

		const { data, error } = await runQuery(client, options);
		expect(error).toBeNull();
		expect(data).toEqual({ id: "u1" });
		const cached = client.getQueryData(options.queryKey);
		expect(cached).toEqual({ id: "u1" });
	});

	it("returns Err with the Result's error, typed", async () => {
		type NotFound = { name: "NotFound"; message: string };
		const client = new QueryClient();
		const options = resultQueryOptions({
			queryKey: ["users", "missing"],
			queryFn: (): Result<{ id: string }, NotFound> =>
				Err({ name: "NotFound", message: "No user" }),
		});

		const result = await runQuery(client, options);
		expectTypeOf(result).toEqualTypeOf<
			Result<{ id: string }, NotFound | CancelledError>
		>();
		expect(result.error).toEqual({ name: "NotFound", message: "No user" });
	});

	it("serves fresh cached data without fetching again", async () => {
		const client = new QueryClient();
		let calls = 0;
		const options = resultQueryOptions({
			queryKey: ["counted"],
			queryFn: () => {
				calls++;
				return Ok(calls);
			},
			staleTime: Number.POSITIVE_INFINITY,
		});

		await runQuery(client, options);
		const { data } = await runQuery(client, options);
		expect(data).toBe(1);
		expect(calls).toBe(1);
	});

	it("accepts any cached data with staleTime 'static'", async () => {
		const client = new QueryClient();
		let calls = 0;
		const options = resultQueryOptions({
			queryKey: ["static"],
			queryFn: () => Ok(++calls),
		});

		client.setQueryData(options.queryKey, 0);
		const { data } = await runQuery(client, {
			...options,
			staleTime: "static",
		});
		expect(data).toBe(0);
		expect(calls).toBe(0);
	});

	it("returns Err(CancelledError) when the client is cleared mid-flight", async () => {
		const client = new QueryClient();
		const { promise, resolve } = Promise.withResolvers<void>();
		const options = resultQueryOptions({
			queryKey: ["slow"],
			queryFn: async () => {
				await promise;
				return Ok("late");
			},
		});

		const pending = runQuery(client, options);
		await Promise.resolve();
		client.clear();
		resolve();

		const { error } = await pending;
		expect(error).toBeInstanceOf(CancelledError);
		expect(client.getQueryData(options.queryKey)).toBeUndefined();
	});
});

describe("runMutation", () => {
	it("returns Ok with the data", async () => {
		const client = new QueryClient();
		const options = resultMutationOptions({
			mutationKey: ["double"],
			mutationFn: (n: number) => Ok(n * 2),
		});

		const { data, error } = await runMutation(client, options, 3);
		expect(error).toBeNull();
		expect(data).toBe(6);
	});

	it("returns Err with the Result's error", async () => {
		const client = new QueryClient();
		const options = resultMutationOptions({
			mutationKey: ["fail"],
			mutationFn: () => Err("fail"),
		});

		const { data, error } = await runMutation(client, options, undefined);
		expect(data).toBeNull();
		expect(error).toBe("fail");
	});

	it("runs definition callbacks with the executing client", async () => {
		const client = new QueryClient();
		const todos = resultQueryOptions({
			queryKey: ["todos"],
			queryFn: () => Ok(["milk"]),
		});
		await runQuery(client, todos);

		const addTodo = resultMutationOptions({
			mutationKey: ["todos", "add"],
			mutationFn: (title: string) => Ok(title),
			onSuccess: (_data, _title, _onMutateResult, { client }) =>
				client.invalidateQueries({ queryKey: ["todos"] }),
		});

		await runMutation(client, addTodo, "eggs");
		expect(client.getQueryState(todos.queryKey)?.isInvalidated).toBe(true);
	});

	it("registers in the mutation cache while running", async () => {
		const client = new QueryClient();
		const { promise, resolve } = Promise.withResolvers<void>();
		const options = resultMutationOptions({
			mutationKey: ["slow-save"],
			mutationFn: async () => {
				await promise;
				return Ok(null);
			},
		});

		const pending = runMutation(client, options, undefined);
		expect(client.isMutating({ mutationKey: ["slow-save"] })).toBe(1);
		resolve();
		await pending;
		expect(client.isMutating({ mutationKey: ["slow-save"] })).toBe(0);
	});

	it("lets the finished mutation be garbage collected", async () => {
		const client = new QueryClient();
		const options = resultMutationOptions({
			mutationKey: ["gc"],
			mutationFn: () => Ok(null),
			gcTime: 0,
		});

		await runMutation(client, options, undefined);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(client.getMutationCache().getAll()).toHaveLength(0);
	});
});

describe("key factories", () => {
	it("keep literal types when spread from a root constant", () => {
		const todosRoot = ["todos"] as const;
		const todoKeys = {
			all: todosRoot,
			detail: (id: string) => [...todosRoot, "detail", id] as const,
		};

		expectTypeOf(todoKeys.all).toEqualTypeOf<readonly ["todos"]>();
		expectTypeOf(todoKeys.detail("1")).toEqualTypeOf<
			readonly ["todos", "detail", string]
		>();
	});
});
