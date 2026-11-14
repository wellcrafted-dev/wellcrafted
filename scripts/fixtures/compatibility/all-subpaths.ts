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
	resultQueries,
	resultMutations,
	type ResultQuery,
	type ResultMutation,
	runQuery,
	runMutation,
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

const service = {
	get: (id: UserId): Result<UserId, FixtureError> =>
		id === "missing" ? FixtureError.Missing({ id }) : Ok(id),
	save: (id: UserId): Result<UserId, FixtureError> => Ok(id),
};
const queries = resultQueries(["fixtures"], { detail: service.get });
const writes = resultMutations(["fixtures"], { save: service.save });
const query: ResultQuery<readonly ["fixtures"], "detail", typeof service.get> =
	queries.detail;
const mutation: ResultMutation<
	readonly ["fixtures"],
	"save",
	typeof service.save
> = writes.save;
resultQueryOptions({
	queryKey: query(userId).queryKey,
	queryFn: () => result,
});
resultMutationOptions({
	mutationKey: ["fixtures", "save"],
	mutationFn: (id: UserId) => Ok(id),
});

declare const queryClient: Parameters<typeof runQuery>[0];
runQuery(queryClient, query(userId));
runMutation(queryClient, mutation, userId);
