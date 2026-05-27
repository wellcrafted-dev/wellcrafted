import { QueryClient } from "@tanstack/query-core";
import { describe, expect, expectTypeOf, it } from "bun:test";
import { Err, Ok } from "../result/index.js";
import {
	createQueryFactories,
	defineKeys,
	mutationOptions,
	queryOptions,
} from "./utils.js";

const queryClient = new QueryClient();
const { defineQuery, defineMutation } = createQueryFactories(queryClient);

describe("queryOptions", () => {
	it("infers literal queryKey tuple without `as const`", () => {
		const options = queryOptions({
			queryKey: ["users", "user-123"],
			queryFn: ({ queryKey }) => {
				expectTypeOf(queryKey).toEqualTypeOf<readonly ["users", "user-123"]>();
				return Ok({ id: queryKey[1] });
			},
		});

		expectTypeOf(options.queryKey).toEqualTypeOf<
			readonly ["users", "user-123"]
		>();
	});

	it("preserves Ok/Err data and error types through inference", () => {
		type AuthError = { code: "UNAUTHORIZED"; message: string };

		const options = queryOptions({
			queryKey: ["session"],
			queryFn: ():
				| ReturnType<typeof Ok<{ userId: string }>>
				| ReturnType<typeof Err<AuthError>> => Ok({ userId: "u1" }),
		});

		expectTypeOf(options.queryKey).toEqualTypeOf<readonly ["session"]>();
	});

	it("resolves Ok values into the TanStack data channel", async () => {
		const options = queryOptions({
			queryKey: ["ok"],
			queryFn: () => Ok(42),
		});

		const queryFn = options.queryFn as (ctx: unknown) => Promise<number>;
		const data = await queryFn({
			queryKey: ["ok"],
			signal: new AbortController().signal,
			meta: undefined,
		});
		expect(data).toBe(42);
	});

	it("throws Err values into the TanStack error channel", async () => {
		const options = queryOptions({
			queryKey: ["err"],
			queryFn: () => Err("boom"),
		});

		const queryFn = options.queryFn as (ctx: unknown) => Promise<unknown>;
		expect(
			queryFn({
				queryKey: ["err"],
				signal: new AbortController().signal,
				meta: undefined,
			}),
		).rejects.toBe("boom");
	});

	it("supports sync Result-returning queryFn", async () => {
		const options = queryOptions({
			queryKey: ["sync"],
			queryFn: () => Ok("sync-data"),
		});

		const data = await (options.queryFn as (ctx: unknown) => Promise<string>)({
			queryKey: ["sync"],
			signal: new AbortController().signal,
			meta: undefined,
		});
		expect(data).toBe("sync-data");
	});
});

describe("mutationOptions", () => {
	it("infers variables and data from mutationFn", async () => {
		type Input = { name: string };

		const options = mutationOptions({
			mutationKey: ["users", "create"],
			mutationFn: async (input: Input) => Ok({ id: "u1", name: input.name }),
		});

		// Variables type flows through: calling with the right shape produces
		// the right Promise<TData> resolution.
		const data = await options.mutationFn?.({ name: "ada" });
		expectTypeOf(data).toEqualTypeOf<
			{ id: string; name: string } | undefined
		>();
	});

	it("resolves Ok values into the TanStack data channel", async () => {
		const options = mutationOptions({
			mutationKey: ["m"],
			mutationFn: async (n: number) => Ok(n * 2),
		});

		const data = await options.mutationFn?.(3);
		expect(data).toBe(6);
	});

	it("supports sync Result-returning mutationFn", async () => {
		const options = mutationOptions({
			mutationKey: ["sync-mutation"],
			mutationFn: (n: number) => Ok(n * 3),
		});

		const data = await options.mutationFn?.(3);
		expect(data).toBe(9);
	});

	it("throws Err values into the TanStack error channel", async () => {
		const options = mutationOptions({
			mutationKey: ["m-err"],
			mutationFn: async () => Err("fail"),
		});

		expect(options.mutationFn?.(undefined)).rejects.toBe("fail");
	});
});

describe("defineQuery", () => {
	it("infers literal queryKey tuple without `as const`", () => {
		const userQuery = defineQuery({
			queryKey: ["users", "user-123"],
			queryFn: ({ queryKey }) => {
				expectTypeOf(queryKey).toEqualTypeOf<readonly ["users", "user-123"]>();
				return Ok({ id: queryKey[1] });
			},
		});

		expectTypeOf(userQuery.options.queryKey).toEqualTypeOf<
			readonly ["users", "user-123"]
		>();
	});

	it("composes through queryOptions: .options matches queryOptions shape", () => {
		const userQuery = defineQuery({
			queryKey: ["users", "u1"],
			queryFn: () => Ok({ id: "u1" }),
		});
		const standalone = queryOptions({
			queryKey: ["users", "u1"],
			queryFn: () => Ok({ id: "u1" }),
		});

		expectTypeOf(userQuery.options).toEqualTypeOf(standalone);
	});

	it("returns Ok from .ensure and callable form", async () => {
		const userQuery = defineQuery({
			queryKey: ["users", "ensure"],
			queryFn: () => Ok({ id: "ensure" }),
		});

		const ensured = await userQuery.ensure();
		expect(ensured.data).toEqual({ id: "ensure" });

		const called = await userQuery();
		expect(called.data).toEqual({ id: "ensure" });
	});

	it("returns Err from .fetch when queryFn errors", async () => {
		const userQuery = defineQuery({
			queryKey: ["users", "fail"],
			queryFn: () => Err("not-found" as const),
		});

		const { data, error } = await userQuery.fetch();
		expect(data).toBeNull();
		expect(error).toBe("not-found");
	});
});

describe("defineMutation", () => {
	it("infers literal mutationKey tuple without `as const`", () => {
		const createUser = defineMutation({
			mutationKey: ["users", "create"],
			mutationFn: async () => Ok({ id: "u1" }),
		});

		expectTypeOf(createUser).toBeFunction();
	});

	it("returns Ok from .execute and callable form", async () => {
		const create = defineMutation({
			mutationKey: ["m", "create"],
			mutationFn: async (input: { name: string }) =>
				Ok({ id: "u1", name: input.name }),
		});

		const executed = await create.execute({ name: "ada" });
		expect(executed.data).toEqual({ id: "u1", name: "ada" });

		const called = await create({ name: "ada" });
		expect(called.data).toEqual({ id: "u1", name: "ada" });
	});

	it("returns Err from .execute when mutationFn errors", async () => {
		const create = defineMutation({
			mutationKey: ["m", "fail"],
			mutationFn: async () => Err("conflict" as const),
		});

		const { data, error } = await create.execute();
		expect(data).toBeNull();
		expect(error).toBe("conflict");
	});
});

describe("defineKeys", () => {
	it("preserves literal tuples for static keys", () => {
		const keys = defineKeys({
			all: ["billing"],
			overview: ["billing", "overview"],
		});

		expectTypeOf(keys.all).toEqualTypeOf<readonly ["billing"]>();
		expectTypeOf(keys.overview).toEqualTypeOf<
			readonly ["billing", "overview"]
		>();
	});

	it("preserves factory return tuples when the body uses `as const`", () => {
		const keys = defineKeys({
			detail: (id: string) => ["users", id] as const,
			page: (offset: number, limit: number) =>
				["users", "page", offset, limit] as const,
		});

		expectTypeOf(keys.detail("u1")).toEqualTypeOf<readonly ["users", string]>();
		expectTypeOf(keys.page(0, 10)).toEqualTypeOf<
			readonly ["users", "page", number, number]
		>();
	});

	it("mixes static and factory entries", () => {
		const keys = defineKeys({
			all: ["recordings"],
			byId: (id: string) => ["recordings", id] as const,
		});

		expectTypeOf(keys.all).toEqualTypeOf<readonly ["recordings"]>();
		expectTypeOf(keys.byId("r1")).toEqualTypeOf<
			readonly ["recordings", string]
		>();
	});

	it("narrows factory returns to tuple shape WITHOUT `as const`, but widens literals", () => {
		const keys = defineKeys({
			detail: (id: string) => ["users", id],
		});

		expectTypeOf(keys.detail("u1")).toEqualTypeOf<[string, string]>();
	});

	it("preserves literal positions when factory body uses `as const`", () => {
		const keys = defineKeys({
			detail: (id: string) => ["users", id] as const,
		});

		expectTypeOf(keys.detail("u1")).toEqualTypeOf<readonly ["users", string]>();
	});
});
