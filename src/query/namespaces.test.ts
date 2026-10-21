/** Verifies native options, per-method inference, generated identity, and shared mutation policy. */
import { describe, expect, expectTypeOf, it } from "bun:test";
import {
	type CancelledError,
	type DataTag,
	type dataTagErrorSymbol,
	type MutationFunctionContext,
	type MutationKey,
	MutationObserver,
	QueryClient,
	QueryObserver,
} from "@tanstack/query-core";
import { Err, Ok, type Result } from "../result/index.js";
import {
	createMutations,
	createQueries,
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

describe("createQueries", () => {
	it("heterogeneous factories preserve arguments, literal keys, and cache tags", () => {
		const queries = createQueries(["users"], {
			getUser,
			listUsers: { queryFn: listUsers },
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

	it("construction and factory calls never execute services or mutate definitions", () => {
		let calls = 0;
		const service = () => {
			calls++;
			return Ok(null);
		};
		const namespace = Object.freeze(["users"] as const);
		const descriptor = Object.freeze({ queryFn: service, staleTime: 100 });
		const queries = createQueries(
			namespace,
			Object.freeze({ read: descriptor }),
		);
		const mutations = createMutations(
			namespace,
			Object.freeze({ write: service }),
		);
		queries.read();
		mutations.write();
		expect(calls).toBe(0);
		expect(descriptor).toEqual({ queryFn: service, staleTime: 100 });
	});

	it("argument tuples prevent path collisions and preserve omitted optional arguments", async () => {
		const client = new QueryClient();
		const queries = createQueries(["users"], { getUser, events });
		const nested = createQueries(["users", "getUser"], { list: listUsers });
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

	it("generated identity ignores hidden descriptor keys and hashes", async () => {
		const descriptor = {
			queryFn: (id: string) => Ok(id),
			staleTime: Infinity,
		};
		// JavaScript callers can supply fields absent from a TypeScript annotation.
		Object.assign(descriptor, { queryKey: ["override"], queryHash: "fixed" });
		const queries = createQueries(["users"], { get: descriptor });
		const client = new QueryClient();
		expect(await runQuery(client, queries.get("u1"))).toEqual(Ok("u1"));
		expect(await runQuery(client, queries.get("u2"))).toEqual(Ok("u2"));
		expect(client.getQueryCache().getAll()).toHaveLength(2);
	});

	it("computed prototype names remain ordinary own factories", async () => {
		const definitions = { ["__proto__"]: () => Ok("own") };
		const queries = createQueries(["users"], definitions);
		const mutations = createMutations(["users"], definitions);
		const client = new QueryClient();
		for (const namespace of [queries, mutations]) {
			expect(Object.hasOwn(namespace, "__proto__")).toBe(true);
			expect(Object.keys(namespace)).toEqual(["__proto__"]);
			expect(Object.getPrototypeOf(namespace)).toBe(Object.prototype);
		}
		expect(await runQuery(client, queries.__proto__())).toEqual(Ok("own"));
		expect(await runMutation(client, mutations.__proto__(), undefined)).toEqual(
			Ok("own"),
		);
	});

	it("numeric names use JavaScript string keys while symbol entries are not mapped", async () => {
		const hidden = Symbol("hidden");
		const queries = createQueries(["users"], {
			0: { queryFn: getUser, select: (value) => value.name },
			1: getUser,
			[hidden]: getUser,
		});
		const mutations = createMutations(["users"], {
			0: {
				mutationFn: updateUser,
				onMutate: (input: User) => ({ previous: input }),
				onSuccess: (_saved, _input, rollback) => {
					expectTypeOf(rollback).toEqualTypeOf<{ previous: User }>();
				},
			},
			1: updateUser,
			[hidden]: updateUser,
		});
		expectTypeOf(queries[0].key).toEqualTypeOf<readonly ["users", "0"]>();
		expectTypeOf(mutations[0].key).toEqualTypeOf<readonly ["users", "0"]>();
		expect(queries[0].key).toEqual(["users", "0"]);
		expect(mutations[0]().mutationKey).toEqual(["users", "0"]);
		expect(Object.getOwnPropertySymbols(queries)).toHaveLength(0);
		expect(Object.getOwnPropertySymbols(mutations)).toHaveLength(0);
		const client = new QueryClient();
		const selected = await runQuery(client, queries[0]("u1"));
		expectTypeOf(selected).toEqualTypeOf<
			Result<string, NotFound | CancelledError>
		>();
		expect(selected).toEqual(Ok("Ada"));
		expect(await runQuery(client, queries[1]("u1"))).toEqual(Ok(user));
		expect(await runMutation(client, mutations[0](), user)).toEqual(Ok(user));
		expect(await runMutation(client, mutations[1](), user)).toEqual(Ok(user));
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
		const queries = createQueries(["users"], { read: service.read });
		await runQuery(client, queries.read());
		expect(received).toEqual([]);
		expect(receiver).toBeUndefined();
		await runQuery(client, queries.read("u1"));
		expect(received).toEqual(["u1"]);
	});

	it("factory prefixes invalidate every argument variant of one operation", async () => {
		const client = new QueryClient();
		const queries = createQueries(["users"], { search, getUser });
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
		const queries = createQueries(["users"], {
			getUser: { queryFn: getUser, retry: false },
			listUsers,
		});
		expect(await runQuery(client, queries.getUser("u1"))).toEqual(Ok(user));
		expect(await runQuery(client, queries.listUsers())).toEqual(Ok([user]));
		const result = await runQuery(client, queries.getUser("missing"));
		expectTypeOf(result).toEqualTypeOf<
			Result<User, NotFound | CancelledError>
		>();
		expect(result.error).toBe(missing);
		expect(getUser("missing")).toEqual(Err(missing));
	});

	it("mixed entries isolate selected data while retaining original cache tags", async () => {
		const client = new QueryClient();
		const queries = createQueries(["users"], {
			getUser,
			userName: { queryFn: getUser, select: (u) => u.name },
			userCount: { queryFn: listUsers, select: (users) => users.length },
			plain: { queryFn: listUsers },
		});
		const original = await runQuery(client, queries.getUser("u1"));
		const selected = await runQuery(client, queries.userName("u1"));
		const count = await runQuery(client, queries.userCount());
		const plain = await runQuery(client, queries.plain());
		expectTypeOf(original).toEqualTypeOf<
			Result<User, NotFound | CancelledError>
		>();
		expectTypeOf(selected).toEqualTypeOf<
			Result<string, NotFound | CancelledError>
		>();
		expectTypeOf(count).toEqualTypeOf<Result<number, CancelledError>>();
		expectTypeOf(plain).toEqualTypeOf<Result<User[], CancelledError>>();
		expect(original).toEqual(Ok(user));
		expect(selected).toEqual(Ok("Ada"));
		expect(count).toEqual(Ok(1));
		expect(plain).toEqual(Ok([user]));
		const options = queries.userName("u1");
		const observer = new QueryObserver(client, options);
		expectTypeOf(observer.getCurrentResult().data).toEqualTypeOf<
			string | undefined
		>();
		expect(observer.getCurrentResult().data).toBe("Ada");
		const originalCached = client.getQueryData(queries.getUser("u1").queryKey);
		const nameCached = client.getQueryData(options.queryKey);
		const countCached = client.getQueryData(queries.userCount().queryKey);
		expectTypeOf(originalCached).toEqualTypeOf<User | undefined>();
		expectTypeOf(nameCached).toEqualTypeOf<User | undefined>();
		expectTypeOf(countCached).toEqualTypeOf<User[] | undefined>();
		expect(nameCached).toEqual(user);
	});

	it("native callbacks infer service types and staleTime prevents a fresh refetch", async () => {
		let calls = 0;
		const client = new QueryClient();
		const queries = createQueries(["users"], {
			getUser: {
				queryFn: (id: string): Result<User, NotFound> => {
					calls++;
					return getUser(id);
				},
				staleTime: Infinity,
				retry: (count, error) => {
					expectTypeOf(count).toEqualTypeOf<number>();
					expectTypeOf(error).toEqualTypeOf<NotFound>();
					return false;
				},
				throwOnError: (error) => {
					expectTypeOf(error).toEqualTypeOf<NotFound>();
					return false;
				},
				placeholderData: (previous) => {
					expectTypeOf(previous).toEqualTypeOf<User | undefined>();
					return previous;
				},
				initialData: () => undefined,
				enabled: (query) => {
					expectTypeOf(query.queryKey).toEqualTypeOf<
						readonly ["users", "getUser", [id: string]]
					>();
					return true;
				},
				refetchInterval: (query) => {
					expectTypeOf(query.state.data).toEqualTypeOf<User | undefined>();
					return false;
				},
			},
			seeded: { queryFn: getUser, initialData: user },
		});
		await runQuery(client, queries.getUser("u1"));
		await runQuery(client, queries.getUser("u1"));
		expect(calls).toBe(1);
		expect(queries.seeded("u1").initialData).toBe(user);
	});
});

describe("createMutations", () => {
	it("mutations infer required, optional, and void variables and forward only variables", async () => {
		const client = new QueryClient();
		let received: unknown[] = [];
		const mutations = createMutations(["users"], {
			updateUser,
			logout,
			rename,
			record: (...args: [input?: { name: string }]) => {
				received = args;
				return Ok(null);
			},
		});
		const logoutObserver = new MutationObserver(client, mutations.logout());
		const renameObserver = new MutationObserver(client, mutations.rename());
		const updateObserver = new MutationObserver(client, mutations.updateUser());
		const recordObserver = new MutationObserver(client, mutations.record());
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
		expectTypeOf<Parameters<typeof recordObserver.mutate>[0]>().toEqualTypeOf<
			// biome-ignore lint/suspicious/noConfusingVoidType: Assert the native optional parameter type exactly.
			{ name: string } | void | undefined
		>();
		// Native mutationKey intersects the general MutationKey with our literal key.
		expectTypeOf(mutations.updateUser().mutationKey).toEqualTypeOf<
			MutationKey & readonly ["users", "updateUser"]
		>();
		expectTypeOf(mutations.updateUser.key).toEqualTypeOf<
			readonly ["users", "updateUser"]
		>();
		expect(mutations.updateUser().mutationKey).toEqual(
			mutations.updateUser.key,
		);
		expect(mutations.updateUser.key).toEqual(["users", "updateUser"]);
		expect(await runMutation(client, mutations.logout(), undefined)).toEqual(
			Ok(null),
		);
		expect(await runMutation(client, mutations.rename(), undefined)).toEqual(
			Ok("anonymous"),
		);
		expect(
			await runMutation(client, mutations.rename(), { name: "Ada" }),
		).toEqual(Ok("Ada"));
		expect(await runMutation(client, mutations.updateUser(), user)).toEqual(
			Ok(user),
		);
		expect(await logoutObserver.mutate()).toBeNull();
		expect(await renameObserver.mutate()).toBe("anonymous");
		await recordObserver.mutate();
		expect(received).toEqual([undefined]);
	});

	it("mixed mutations isolate annotated rollback types in definition and per-call callbacks", async () => {
		const client = new QueryClient();
		const mutations = createMutations(["users"], {
			updateUser: {
				mutationFn: updateUser,
				onMutate: (input: User, ctx: MutationFunctionContext) => {
					expectTypeOf(ctx.client).toEqualTypeOf<QueryClient>();
					return { previous: input };
				},
				onSuccess: async (saved, input, rollback, { client }) => {
					expectTypeOf(saved).toEqualTypeOf<User>();
					expectTypeOf(input).toEqualTypeOf<User>();
					expectTypeOf(rollback).toEqualTypeOf<{ previous: User }>();
					expectTypeOf(client).toEqualTypeOf<QueryClient>();
				},
				onError: (error, input, rollback) => {
					expectTypeOf(error).toEqualTypeOf<SaveError>();
					expectTypeOf(input).toEqualTypeOf<User>();
					expectTypeOf(rollback).toEqualTypeOf<
						{ previous: User } | undefined
					>();
				},
			},
			rename: {
				mutationFn: rename,
				onMutate: (
					// biome-ignore lint/suspicious/noConfusingVoidType: Match the optional service variables type.
					input: { name: string } | void,
					_context: MutationFunctionContext,
				) => ({ before: input?.name ?? "anonymous" }),
				onSuccess: (_saved, _input, rollback) => {
					expectTypeOf(rollback).toEqualTypeOf<{ before: string }>();
				},
			},
			logout,
		});
		expectTypeOf<
			Parameters<
				NonNullable<ReturnType<typeof mutations.logout>["onSuccess"]>
			>[2]
		>().toEqualTypeOf<unknown>();
		const observer = new MutationObserver(client, mutations.rename());
		const unsubscribe = observer.subscribe(() => {});
		let perCall = false;
		expect(
			await observer.mutate(
				{ name: "Grace" },
				{
					onSuccess: (_data, _variables, rollback) => {
						expectTypeOf(rollback).toEqualTypeOf<
							{ before: string } | undefined
						>();
						perCall = true;
					},
				},
			),
		).toBe("Grace");
		unsubscribe();
		expect(perCall).toBe(true);
		expect(await runMutation(client, mutations.updateUser(), user)).toEqual(
			Ok(user),
		);
	});

	it("types unannotated onMutate inputs; its rollback stays unknown", async () => {
		const client = new QueryClient();
		const mutations = createMutations(["users"], {
			updateUser: {
				mutationFn: updateUser,
				onMutate: (input, context) => {
					expectTypeOf(input).toEqualTypeOf<User>();
					expectTypeOf(context).toEqualTypeOf<MutationFunctionContext>();
					return { previous: input };
				},
				onSuccess: (_saved, _input, rollback) => {
					expectTypeOf(rollback).toEqualTypeOf<unknown>();
				},
			},
		});
		expect(await runMutation(client, mutations.updateUser(), user)).toEqual(
			Ok(user),
		);
	});

	it("definition policy uses the executing client and invalidates selected reads", async () => {
		const client = new QueryClient();
		const queries = createQueries(["users"], { getUser, listUsers });
		await runQuery(client, queries.getUser("u1"));
		await runQuery(client, queries.getUser("u2"));
		await runQuery(client, queries.listUsers());
		let executing: QueryClient | undefined;
		const mutations = createMutations(["users"], {
			updateUser: {
				mutationFn: updateUser,
				onSuccess: async (saved, input, _rollback, { client }) => {
					expectTypeOf(saved).toEqualTypeOf<User>();
					expectTypeOf(input).toEqualTypeOf<User>();
					executing = client;
					await Promise.all([
						client.invalidateQueries({
							queryKey: queries.getUser(input.id).queryKey,
							exact: true,
						}),
						client.invalidateQueries({ queryKey: queries.listUsers.key }),
					]);
				},
			},
		});
		await runMutation(client, mutations.updateUser(), user);
		expect(executing).toBe(client);
		expect(
			client.getQueryState(queries.getUser("u1").queryKey)?.isInvalidated,
		).toBe(true);
		expect(
			client.getQueryState(queries.getUser("u2").queryKey)?.isInvalidated,
		).toBe(false);
		expect(
			client.getQueryState(queries.listUsers().queryKey)?.isInvalidated,
		).toBe(true);
	});

	it("awaited definition policy keeps mutation pending until it completes", async () => {
		const client = new QueryClient();
		const entered = Promise.withResolvers<void>();
		const gate = Promise.withResolvers<void>();
		const mutations = createMutations(["users"], {
			updateUser: {
				mutationFn: updateUser,
				onSuccess: () => {
					entered.resolve();
					return gate.promise;
				},
			},
		});
		let resolved = false;
		const pending = runMutation(client, mutations.updateUser(), user).then(
			(result) => {
				resolved = true;
				return result;
			},
		);
		await entered.promise;
		expect(client.isMutating({ mutationKey: mutations.updateUser.key })).toBe(
			1,
		);
		expect(resolved).toBe(false);
		gate.resolve();
		expect(await pending).toEqual(Ok(user));
		expect(client.isMutating({ mutationKey: mutations.updateUser.key })).toBe(
			0,
		);
	});

	it("definition policy survives observer reset while per-call callbacks depart", async () => {
		const client = new QueryClient();
		const gate = Promise.withResolvers<Result<User, SaveError>>();
		let sharedCalls = 0;
		let perCall = 0;
		const mutations = createMutations(["users"], {
			updateUser: {
				mutationFn: (_input: User) => gate.promise,
				onSuccess: () => {
					sharedCalls++;
				},
			},
		});
		const observer = new MutationObserver(client, mutations.updateUser());
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
		expect(sharedCalls).toBe(1);
		expect(perCall).toBe(0);
	});
});

describe("type errors", () => {
	it("rejects untyped service wrappers", () => {
		const queries = createQueries(["users"], { get: (id) => getUser(id) });
		expectTypeOf(queries.get).parameters.toEqualTypeOf<[id: never]>();
		// @ts-expect-error — an unannotated wrapper cannot silently accept any input
		queries.get(123);
		// @ts-expect-error — annotate the input of a newly defined service wrapper
		createMutations(["users"], { update: (input) => updateUser(input) });
	});

	it("rejects generated keys, misspelled options, and multi-argument mutations", () => {
		createQueries(["users"], {
			// @ts-expect-error — query keys are generated
			getUser: { queryFn: getUser, queryKey: ["override"] },
		});
		createQueries(["users"], {
			// @ts-expect-error — misspelled native option
			getUser: { queryFn: getUser, staleTim: 100 },
		});
		const fixedHash = { queryFn: getUser, queryHash: "fixed" };
		// @ts-expect-error — hashes cannot override generated identity, including in variable descriptors
		createQueries(["users"], { getUser: fixedHash });
		const fixedKey = { queryFn: getUser, queryKey: ["override"] };
		// @ts-expect-error — keys cannot override generated identity, including in variable descriptors
		createQueries(["users"], { getUser: fixedKey });
		createMutations(["users"], {
			// @ts-expect-error — mutation keys are generated
			updateUser: { mutationFn: updateUser, mutationKey: ["override"] },
		});
		const fixedMutationKey = {
			mutationFn: updateUser,
			mutationKey: ["override"],
		};
		// @ts-expect-error — variable descriptors cannot supply a mutation key either
		createMutations(["users"], { updateUser: fixedMutationKey });
		createMutations(["users"], {
			// @ts-expect-error — misspelled native option
			updateUser: { mutationFn: updateUser, onSucces: () => {} },
		});
		createMutations(["users"], {
			// @ts-expect-error — adapt two arguments to one object
			bad: (_id: string, _name: string) => Ok(null),
		});
		createMutations(["users"], {
			// @ts-expect-error — optional second arguments are also rejected
			bad: (_id: string, _options?: { force: boolean }) => Ok(null),
		});
		createMutations(["users"], {
			// @ts-expect-error — unbounded rest arguments are rejected
			bad: (..._args: string[]) => Ok(null),
		});
		const mutations = createMutations(["users"], { updateUser });
		void (() => {
			// @ts-expect-error — unary service variables are required
			new MutationObserver(new QueryClient(), mutations.updateUser()).mutate();
			// @ts-expect-error — unary service variables retain their type
			runMutation(new QueryClient(), mutations.updateUser(), { id: 1 });
		});
	});
});
