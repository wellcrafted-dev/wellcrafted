/** Verifies generated identity, per-method inference, and composition by spread and by client policy. */
import { describe, expect, expectTypeOf, it } from "bun:test";
import {
	type CancelledError,
	type DataTag,
	type dataTagErrorSymbol,
	MutationCache,
	type MutationKey,
	MutationObserver,
	matchQuery,
	QueryClient,
	type QueryKey,
	QueryObserver,
} from "@tanstack/query-core";
import { Err, Ok, type Result } from "../result/index.js";
import {
	resultMutations,
	resultQueries,
	runMutation,
	runQuery,
} from "./index.js";

type User = { id: string; name: string };
type NotFound = { name: "NotFound"; message: string };
type SaveError = { name: "SaveError"; message: string };
const user: User = { id: "u1", name: "Ada" };
const missing: NotFound = { name: "NotFound", message: "Missing user" };
const getUser = (id: string): Result<User, NotFound> =>
	id === "missing" ? Err(missing) : Ok({ ...user, id });
const listUsers = async (): Promise<Result<User[], never>> => Ok([user]);
const search = (term: string, page?: number): Result<User[], NotFound> =>
	Ok([{ ...user, name: `${term}:${page}` }]);
const events = (filter?: { active?: boolean }): Result<boolean, never> =>
	Ok(filter?.active ?? false);
const updateUser = async (input: User): Promise<Result<User, SaveError>> =>
	Ok(input);
const logout = (): Result<null, never> => Ok(null);
const rename = (input?: { name: string }): Result<string, never> =>
	Ok(input?.name ?? "anonymous");

describe("resultQueries", () => {
	it("factories preserve arguments, literal keys, and cache tags", () => {
		const queries = resultQueries(["users"], {
			getUser,
			listUsers,
			search,
			events,
		});
		const client = new QueryClient();
		const key = queries.getUser("u1").queryKey;
		expectTypeOf(queries.search).parameters.toEqualTypeOf<
			Parameters<typeof search>
		>();
		expectTypeOf(queries.events).parameters.toEqualTypeOf<
			Parameters<typeof events>
		>();
		expectTypeOf(key).toEqualTypeOf<
			DataTag<readonly ["users", "getUser", [id: string]], User, NotFound>
		>();
		expectTypeOf(queries.getUser.key).toEqualTypeOf<
			readonly ["users", "getUser"]
		>();
		expectTypeOf(client.getQueryData(key)).toEqualTypeOf<User | undefined>();
		expectTypeOf(
			client.getQueryData(queries.listUsers().queryKey),
		).toEqualTypeOf<User[] | undefined>();
		expectTypeOf<
			(typeof key)[typeof dataTagErrorSymbol]
		>().toEqualTypeOf<NotFound>();
		expect<unknown>(queries.getUser("u1").queryKey).toEqual([
			"users",
			"getUser",
			["u1"],
		]);
		expect<unknown>(queries.listUsers().queryKey).toEqual([
			"users",
			"listUsers",
			[],
		]);
		expect<unknown>(queries.search("Ada", 2).queryKey).toEqual([
			"users",
			"search",
			["Ada", 2],
		]);
		expect<unknown>(queries.events().queryKey).toEqual(["users", "events", []]);
		expect<unknown>(queries.events({}).queryKey).toEqual([
			"users",
			"events",
			[{}],
		]);
		// @ts-expect-error — required service argument remains required
		queries.getUser();
	});

	it("construction and factory calls never execute services", () => {
		let calls = 0;
		const service = () => {
			calls++;
			return Ok(null);
		};
		const namespace = Object.freeze(["users"] as const);
		const queries = resultQueries(namespace, Object.freeze({ read: service }));
		resultMutations(namespace, Object.freeze({ write: service }));
		queries.read();
		expect(calls).toBe(0);
	});

	it("argument tuples prevent path collisions and preserve omitted optional arguments", async () => {
		const client = new QueryClient();
		const queries = resultQueries(["users"], { getUser, events });
		const nested = resultQueries(["users", "getUser"], { list: listUsers });
		await runQuery(client, queries.getUser("list"));
		await runQuery(client, nested.list());
		await runQuery(client, queries.events());
		await runQuery(client, queries.events({}));
		const cachedUser = client.getQueryData(queries.getUser("list").queryKey);
		expect(cachedUser).toEqual({ ...user, id: "list" });
		const cachedList = client.getQueryData(nested.list().queryKey);
		expect(cachedList).toEqual([user]);
		expect(client.getQueryCache().getAll()).toHaveLength(4);
	});

	it("computed prototype names remain ordinary own entries", async () => {
		const methods = { ["__proto__"]: () => Ok("own") };
		const queries = resultQueries(["users"], methods);
		const mutations = resultMutations(["users"], methods);
		const client = new QueryClient();
		for (const namespace of [queries, mutations]) {
			expect(Object.hasOwn(namespace, "__proto__")).toBe(true);
			expect(Object.keys(namespace)).toEqual(["__proto__"]);
			expect(Object.getPrototypeOf(namespace)).toBe(Object.prototype);
		}
		expect(await runQuery(client, queries.__proto__())).toEqual(Ok("own"));
		expect(await runMutation(client, mutations.__proto__, undefined)).toEqual(
			Ok("own"),
		);
	});

	it("numeric names use JavaScript string keys while symbol entries are not mapped", async () => {
		const hidden = Symbol("hidden");
		const queries = resultQueries(["users"], { 0: getUser, [hidden]: getUser });
		const mutations = resultMutations(["users"], {
			0: updateUser,
			[hidden]: updateUser,
		});
		expectTypeOf(queries[0].key).toEqualTypeOf<readonly ["users", "0"]>();
		expectTypeOf(mutations[0].mutationKey).toEqualTypeOf<
			MutationKey & readonly ["users", "0"]
		>();
		expect(queries[0].key).toEqual(["users", "0"]);
		expect(mutations[0].mutationKey).toEqual(["users", "0"]);
		expect(Object.getOwnPropertySymbols(queries)).toHaveLength(0);
		expect(Object.getOwnPropertySymbols(mutations)).toHaveLength(0);
		const client = new QueryClient();
		expect(await runQuery(client, queries[0]("u1"))).toEqual(Ok(user));
		expect(await runMutation(client, mutations[0], user)).toEqual(Ok(user));
	});

	it("query execution forwards supplied arguments without a receiver or query context", async () => {
		const client = new QueryClient();
		let received: unknown[] = [];
		let receiver: unknown = "unset";
		const service = {
			read(this: unknown, ...args: [id?: string]): Result<string, never> {
				received = args;
				receiver = this;
				return Ok(args[0] ?? "empty");
			},
		};
		const queries = resultQueries(["users"], { read: service.read });
		await runQuery(client, queries.read());
		expect(received).toEqual([]);
		expect(receiver).toBeUndefined();
		await runQuery(client, queries.read("u1"));
		expect(received).toEqual(["u1"]);
	});

	it("factory prefixes invalidate every argument variant of one method", async () => {
		const client = new QueryClient();
		const queries = resultQueries(["users"], { search, getUser });
		await runQuery(client, queries.search("Ada"));
		await runQuery(client, queries.search("Grace", 2));
		await runQuery(client, queries.getUser("u1"));
		await client.invalidateQueries({ queryKey: queries.search.key });
		expect(
			client.getQueryState(queries.search("Ada").queryKey)?.isInvalidated,
		).toBe(true);
		expect(
			client.getQueryState(queries.search("Grace", 2).queryKey)?.isInvalidated,
		).toBe(true);
		expect(
			client.getQueryState(queries.getUser("u1").queryKey)?.isInvalidated,
		).toBe(false);
	});

	it("sync and async Results convert through runners and preserve error identity", async () => {
		const client = new QueryClient();
		const queries = resultQueries(["users"], { getUser, listUsers });
		expect(await runQuery(client, queries.getUser("u1"))).toEqual(Ok(user));
		expect(await runQuery(client, queries.listUsers())).toEqual(Ok([user]));
		const result = await runQuery(client, {
			...queries.getUser("missing"),
			retry: false,
		});
		expectTypeOf(result).toEqualTypeOf<
			Result<User, NotFound | CancelledError>
		>();
		expect(result.error).toBe(missing);
	});

	it("options spread at the use site are inferred, and select leaves the cache tag alone", async () => {
		const client = new QueryClient();
		const queries = resultQueries(["users"], { getUser, listUsers });
		const count = await runQuery(client, {
			...queries.listUsers(),
			select: (users) => users.length,
		});
		expectTypeOf(count).toEqualTypeOf<Result<number, CancelledError>>();
		expect(count).toEqual(Ok(1));
		const name = {
			...queries.getUser("u1"),
			select: (u: User) => u.name,
			retry: (_count: number, error: NotFound) => {
				expectTypeOf(error).toEqualTypeOf<NotFound>();
				return false;
			},
		};
		await runQuery(client, name);
		const observer = new QueryObserver(client, name);
		expectTypeOf(observer.getCurrentResult().data).toEqualTypeOf<
			string | undefined
		>();
		expect(observer.getCurrentResult().data).toBe("Ada");
		const cached = client.getQueryData(name.queryKey);
		expectTypeOf(cached).toEqualTypeOf<User | undefined>();
		expect(cached).toEqual(user);
	});

	it("query defaults set by a factory's key apply to every argument variant", async () => {
		let calls = 0;
		const queries = resultQueries(["users"], {
			getUser: (id: string): Result<User, NotFound> => {
				calls++;
				return getUser(id);
			},
		});
		const client = new QueryClient();
		client.setQueryDefaults(queries.getUser.key, { staleTime: Infinity });
		await runQuery(client, queries.getUser("u1"));
		await runQuery(client, queries.getUser("u1"));
		await runQuery(client, queries.getUser("u2"));
		expect(calls).toBe(2);
	});
});

describe("resultMutations", () => {
	it("entries are options; variables are inferred and only they reach the method", async () => {
		const client = new QueryClient();
		let received: unknown[] = [];
		const mutations = resultMutations(["users"], {
			updateUser,
			logout,
			rename,
			record: (...args: [input?: { name: string }]) => {
				received = args;
				return Ok(null);
			},
		});
		const logoutObserver = new MutationObserver(client, mutations.logout);
		const renameObserver = new MutationObserver(client, mutations.rename);
		const updateObserver = new MutationObserver(client, mutations.updateUser);
		const recordObserver = new MutationObserver(client, mutations.record);
		expectTypeOf<Parameters<typeof logoutObserver.mutate>[0]>().toEqualTypeOf<
			// biome-ignore lint/suspicious/noConfusingVoidType: Assert the native optional parameter type exactly.
			void | undefined
		>();
		expectTypeOf<Parameters<typeof renameObserver.mutate>[0]>().toEqualTypeOf<
			// biome-ignore lint/suspicious/noConfusingVoidType: Assert the native optional parameter type exactly.
			{ name: string } | void | undefined
		>();
		expectTypeOf<
			Parameters<typeof updateObserver.mutate>[0]
		>().toEqualTypeOf<User>();
		// Native mutationKey intersects the general MutationKey with our literal key.
		expectTypeOf(mutations.updateUser.mutationKey).toEqualTypeOf<
			MutationKey & readonly ["users", "updateUser"]
		>();
		expect(mutations.updateUser.mutationKey).toEqual(["users", "updateUser"]);
		expect(await runMutation(client, mutations.logout, undefined)).toEqual(
			Ok(null),
		);
		expect(await runMutation(client, mutations.rename, undefined)).toEqual(
			Ok("anonymous"),
		);
		expect(
			await runMutation(client, mutations.rename, { name: "Ada" }),
		).toEqual(Ok("Ada"));
		expect(await runMutation(client, mutations.updateUser, user)).toEqual(
			Ok(user),
		);
		expect(await logoutObserver.mutate()).toBeNull();
		expect(await renameObserver.mutate()).toBe("anonymous");
		await recordObserver.mutate();
		expect(received).toEqual([undefined]);
	});

	it("callbacks spread onto an entry infer rollback without annotations and roll back on Err", async () => {
		const client = new QueryClient();
		const queries = resultQueries(["users"], { getUser });
		const saves = resultMutations(["users"], { updateUser });
		const fails = resultMutations(["users"], {
			updateUser: async (_input: User): Promise<Result<User, SaveError>> =>
				Err({ name: "SaveError", message: "disk full" }),
		});
		await runQuery(client, queries.getUser("u1"));
		const optimistic = (entry: typeof saves.updateUser) =>
			new MutationObserver(client, {
				...entry,
				onMutate: (input, { client }) => {
					const key = queries.getUser(input.id).queryKey;
					const before = client.getQueryData(key);
					client.setQueryData(key, input);
					return { key, before };
				},
				onError: (error, _input, rollback, { client }) => {
					expectTypeOf(error).toEqualTypeOf<SaveError>();
					expectTypeOf(rollback?.before).toEqualTypeOf<User | undefined>();
					if (rollback) client.setQueryData(rollback.key, rollback.before);
				},
			});
		const renamed = { ...user, name: "Grace" };
		await optimistic(saves.updateUser).mutate(renamed);
		expect<unknown>(
			client.getQueryData(queries.getUser("u1").queryKey),
		).toEqual(renamed);
		await optimistic(fails.updateUser)
			.mutate({ ...user, name: "Lost" })
			.catch(() => {});
		expect<unknown>(
			client.getQueryData(queries.getUser("u1").queryKey),
		).toEqual(renamed);
	});

	it("one MutationCache rule invalidates every read after any write and keeps the write pending until it settles", async () => {
		const gate = Promise.withResolvers<void>();
		const client = new QueryClient({
			mutationCache: new MutationCache({
				onSettled: async (
					_data,
					_error,
					_variables,
					_rollback,
					_mutation,
					{ client },
				) => {
					await gate.promise;
					await client.invalidateQueries();
				},
			}),
		});
		const users = resultQueries(["users"], { getUser });
		const teams = resultQueries(["teams"], { list: listUsers });
		const write = resultMutations(["users"], { updateUser });
		await runQuery(client, users.getUser("u1"));
		await runQuery(client, teams.list());
		const pending = runMutation(client, write.updateUser, user);
		await Bun.sleep(0);
		expect(
			client.isMutating({ mutationKey: write.updateUser.mutationKey }),
		).toBe(1);
		gate.resolve();
		expect(await pending).toEqual(Ok(user));
		expect(
			client.getQueryState(users.getUser("u1").queryKey)?.isInvalidated,
		).toBe(true);
		expect(client.getQueryState(teams.list().queryKey)?.isInvalidated).toBe(
			true,
		);
	});

	it("a write's meta.invalidates narrows the rule to the keys it lists", async () => {
		const client = new QueryClient({
			mutationCache: new MutationCache({
				onSettled: (
					_data,
					_error,
					_variables,
					_rollback,
					mutation,
					{ client },
				) =>
					client.invalidateQueries({
						predicate: (query) =>
							(mutation.meta?.invalidates as QueryKey[] | undefined)?.some(
								(queryKey) => matchQuery({ queryKey }, query),
							) ?? true,
					}),
			}),
		});
		const users = resultQueries(["users"], { getUser, listUsers });
		const write = resultMutations(["users"], { updateUser });
		await runQuery(client, users.getUser("u1"));
		await runQuery(client, users.listUsers());
		await runMutation(
			client,
			{ ...write.updateUser, meta: { invalidates: [users.listUsers.key] } },
			user,
		);
		expect(
			client.getQueryState(users.listUsers().queryKey)?.isInvalidated,
		).toBe(true);
		expect(
			client.getQueryState(users.getUser("u1").queryKey)?.isInvalidated,
		).toBe(false);
		await runMutation(client, write.updateUser, user);
		expect(
			client.getQueryState(users.getUser("u1").queryKey)?.isInvalidated,
		).toBe(true);
	});

	it("options callbacks survive observer reset while per-call callbacks depart", async () => {
		const client = new QueryClient();
		const gate = Promise.withResolvers<Result<User, SaveError>>();
		let shared = 0;
		let perCall = 0;
		const mutations = resultMutations(["users"], {
			updateUser: (_input: User) => gate.promise,
		});
		const observer = new MutationObserver(client, {
			...mutations.updateUser,
			onSuccess: () => {
				shared++;
			},
		});
		const unsubscribe = observer.subscribe(() => {});
		const pending = observer.mutate(user, {
			onSuccess: () => {
				perCall++;
			},
		});
		observer.reset();
		gate.resolve(Ok(user));
		await pending;
		unsubscribe();
		expect(shared).toBe(1);
		expect(perCall).toBe(0);
	});
});

describe("type errors", () => {
	it("rejects untyped service wrappers", () => {
		const queries = resultQueries(["users"], { get: (id) => getUser(id) });
		expectTypeOf(queries.get).parameters.toEqualTypeOf<[id: never]>();
		// @ts-expect-error — an unannotated wrapper cannot silently accept any input
		queries.get(123);
		// @ts-expect-error — annotate the input of a newly defined service wrapper
		resultMutations(["users"], { update: (input) => updateUser(input) });
	});

	it("rejects multi-argument mutations and wrong variables", () => {
		resultMutations(["users"], {
			// @ts-expect-error — adapt two arguments to one object
			bad: (_id: string, _name: string) => Ok(null),
		});
		resultMutations(["users"], {
			// @ts-expect-error — optional second arguments are also rejected
			bad: (_id: string, _options?: { force: boolean }) => Ok(null),
		});
		resultMutations(["users"], {
			// @ts-expect-error — unbounded rest arguments are rejected
			bad: (..._args: string[]) => Ok(null),
		});
		const mutations = resultMutations(["users"], { updateUser });
		void (() => {
			// @ts-expect-error — unary service variables are required
			new MutationObserver(new QueryClient(), mutations.updateUser).mutate();
			// @ts-expect-error — unary service variables retain their type
			runMutation(new QueryClient(), mutations.updateUser, { id: 1 });
		});
	});
});
