import { describe, it, expectTypeOf } from "vitest";
import type { Brand } from "./brand.js";

describe("Brand", () => {
	it("single brand creates nominal type", () => {
		type UserId = string & Brand<"UserId">;
		type OrderId = string & Brand<"OrderId">;

		const userId = "user-123" as UserId;
		const orderId = "order-456" as OrderId;

		expectTypeOf(userId).toMatchTypeOf<string>();
		expectTypeOf(orderId).toMatchTypeOf<string>();

		// @ts-expect-error - UserId not assignable to OrderId
		const _test1: OrderId = userId;

		// @ts-expect-error - OrderId not assignable to UserId
		const _test2: UserId = orderId;
	});

	it("raw primitive not assignable to branded type", () => {
		type UserId = string & Brand<"UserId">;

		// @ts-expect-error - string not assignable to UserId
		const _test: UserId = "raw-string";
	});

	it("branded type assignable to primitive", () => {
		type UserId = string & Brand<"UserId">;
		const userId = "user-123" as UserId;

		const str: string = userId;
		expectTypeOf(str).toBeString();
	});

	it("stacked brands are not never", () => {
		type Base = string & Brand<"Base">;
		type Child = Base & Brand<"Child">;

		type IsNever<T> = [T] extends [never] ? true : false;
		expectTypeOf<IsNever<Child>>().toEqualTypeOf<false>();
	});

	it("child brand assignable to parent brand", () => {
		type AbsolutePath = string & Brand<"AbsolutePath">;
		type ProjectDir = AbsolutePath & Brand<"ProjectDir">;

		const projectDir = "/home/project" as ProjectDir;

		const abs: AbsolutePath = projectDir;
		expectTypeOf(abs).toMatchTypeOf<AbsolutePath>();
	});

	it("parent brand NOT assignable to child brand", () => {
		type AbsolutePath = string & Brand<"AbsolutePath">;
		type ProjectDir = AbsolutePath & Brand<"ProjectDir">;

		const absolutePath = "/home" as AbsolutePath;

		// @ts-expect-error
		const _test: ProjectDir = absolutePath;
	});

	it("sibling brands are distinct", () => {
		type AbsolutePath = string & Brand<"AbsolutePath">;
		type ProjectDir = AbsolutePath & Brand<"ProjectDir">;
		type ProviderDir = AbsolutePath & Brand<"ProviderDir">;

		const projectDir = "/project" as ProjectDir;
		const providerDir = "/provider" as ProviderDir;

		// @ts-expect-error
		const _test1: ProviderDir = projectDir;

		// @ts-expect-error
		const _test2: ProjectDir = providerDir;
	});

	it("string methods work on hierarchical brands", () => {
		type AbsolutePath = string & Brand<"AbsolutePath">;
		type ProjectDir = AbsolutePath & Brand<"ProjectDir">;

		const projectDir = "/Project" as ProjectDir;

		const lower = projectDir.toLowerCase();
		const upper = projectDir.toUpperCase();
		const len = projectDir.length;

		expectTypeOf(lower).toBeString();
		expectTypeOf(upper).toBeString();
		expectTypeOf(len).toBeNumber();
	});

	it("multiple inheritance works", () => {
		type A = string & Brand<"A">;
		type B = string & Brand<"B">;
		type C = A & B & Brand<"C">;

		const c = "abc" as C;

		const a: A = c;
		const b: B = c;

		expectTypeOf(a).toMatchTypeOf<A>();
		expectTypeOf(b).toMatchTypeOf<B>();
	});

	it("multiple inheritance: parents not assignable to child", () => {
		type A = string & Brand<"A">;
		type B = string & Brand<"B">;
		type C = A & B & Brand<"C">;

		const a = "a" as A;
		const b = "b" as B;

		// @ts-expect-error - A alone not assignable to C
		const _test1: C = a;

		// @ts-expect-error - B alone not assignable to C
		const _test2: C = b;
	});

	it("deep hierarchy works", () => {
		type Level0 = string & Brand<"Level0">;
		type Level1 = Level0 & Brand<"Level1">;
		type Level2 = Level1 & Brand<"Level2">;
		type Level3 = Level2 & Brand<"Level3">;

		const level3 = "deep" as Level3;

		const l0: Level0 = level3;
		const l1: Level1 = level3;
		const l2: Level2 = level3;

		expectTypeOf(l0).toMatchTypeOf<Level0>();
		expectTypeOf(l1).toMatchTypeOf<Level1>();
		expectTypeOf(l2).toMatchTypeOf<Level2>();
	});

	it("works with number", () => {
		type Percentage = number & Brand<"Percentage">;
		type ValidatedPercentage = Percentage & Brand<"Validated">;

		const validated = 50 as ValidatedPercentage;

		const pct: Percentage = validated;
		const num: number = validated;

		expectTypeOf(pct).toMatchTypeOf<Percentage>();
		expectTypeOf(num).toBeNumber();
	});

	it("works with object types", () => {
		type BaseConfig = { host: string } & Brand<"Config">;
		type ValidatedConfig = BaseConfig & Brand<"Validated">;

		const validated = { host: "localhost" } as ValidatedConfig;

		const base: BaseConfig = validated;
		expectTypeOf(validated.host).toBeString();
		expectTypeOf(base).toMatchTypeOf<BaseConfig>();
	});
});
