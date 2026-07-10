import type { Brand } from "wellcrafted/brand";
import { defineErrors, type InferErrors } from "wellcrafted/error";
import { once } from "wellcrafted/function";
import { parseJson, type JsonValue } from "wellcrafted/json";
import {
	composeSinks,
	createLogger,
	memorySink,
	type LogSink,
} from "wellcrafted/logger";
import {
	createQueryFactories,
	defineKeys,
	resultMutationOptions,
	resultQueryOptions,
} from "wellcrafted/query";
import { Err, Ok, partitionResults, type Result } from "wellcrafted/result";
import { OkSchema, type StandardSchemaV1 } from "wellcrafted/standard-schema";
import { expectErr, expectOk } from "wellcrafted/testing";

// @ts-expect-error — the package intentionally has no root export
import type {} from "wellcrafted";

type UserId = string & Brand<"UserId">;
const userId = "user-1" as UserId;

const FixtureError = defineErrors({
	Missing: ({ id }: { id: UserId }) => ({
		message: `Missing ${id}`,
		id,
	}),
});
type FixtureError = InferErrors<typeof FixtureError>;

const result: Result<UserId, FixtureError> = Ok(userId);
const json: JsonValue = { id: expectOk(result) };
parseJson(JSON.stringify(json));
expectErr(Err("expected fixture failure"));
partitionResults([Ok(1), Err("failure")]);

const runOnce = once(() => userId);
runOnce();

const { sink } = memorySink();
const composed: LogSink = composeSinks(sink);
createLogger("compatibility/fixture", composed).info("loaded");

const stringSchema = {
	"~standard": {
		version: 1,
		vendor: "fixture",
		validate: (value: unknown) =>
			typeof value === "string"
				? { value }
				: { issues: [{ message: "Expected a string" }] },
	},
} satisfies StandardSchemaV1<string>;
OkSchema(stringSchema);

const keys = defineKeys({
	all: ["fixtures"],
	detail: (id: UserId) => ["fixtures", id] as const,
});
resultQueryOptions({
	queryKey: keys.detail(userId),
	queryFn: () => result,
});
resultMutationOptions({
	mutationKey: ["fixtures", "save"],
	mutationFn: (id: UserId) => Ok(id),
});

declare const queryClient: Parameters<typeof createQueryFactories>[0];
const factories = createQueryFactories(queryClient);
factories.defineQuery({ queryKey: keys.all, queryFn: () => result });
factories.defineMutation({
	mutationKey: ["fixtures", "save"],
	mutationFn: (id: UserId) => Ok(id),
});
