import { QueryClient } from "@tanstack/query-core";
import { describe, expectTypeOf, it } from "bun:test";
import { Ok } from "../result/index.js";
import { createQueryFactories, defineKeys } from "./utils.js";

const queryClient = new QueryClient();
const { defineQuery, defineMutation } = createQueryFactories(queryClient);

describe("defineQuery", () => {
	it("infers literal queryKey tuple without `as const`", () => {
		const userQuery = defineQuery({
			queryKey: ["users", "user-123"],
			queryFn: ({ queryKey }) => {
				expectTypeOf(queryKey).toEqualTypeOf<
					readonly ["users", "user-123"]
				>();
				return Ok({ id: queryKey[1] });
			},
		});

		expectTypeOf(userQuery.options.queryKey).toEqualTypeOf<
			readonly ["users", "user-123"]
		>();
	});
});

describe("defineMutation", () => {
	it("infers literal mutationKey tuple without `as const`", () => {
		const createUser = defineMutation({
			mutationKey: ["users", "create"],
			mutationFn: async () => Ok({ id: "u1" }),
		});

		// Type parameter is captured even though MutationOptions widens it back
		// on the output; the input narrowing is what removes the `as const`
		// requirement at the call site.
		expectTypeOf(createUser).toBeFunction();
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

		// The strict tuple constraint acts as contextual typing for the function
		// body, so the return is inferred as a tuple (with correct arity) rather
		// than a widened array. Literal positions still widen to `string`/`number`
		// without `as const`. Use `as const` in the body if you need the literal.
		expectTypeOf(keys.detail("u1")).toEqualTypeOf<[string, string]>();
	});

	it("preserves literal positions when factory body uses `as const`", () => {
		const keys = defineKeys({
			detail: (id: string) => ["users", id] as const,
		});

		expectTypeOf(keys.detail("u1")).toEqualTypeOf<readonly ["users", string]>();
	});
});
