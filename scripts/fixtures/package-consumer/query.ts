import { QueryClient } from "@tanstack/query-core";
import {
	resultMutations,
	resultQueries,
	resultMutationOptions,
	resultQueryOptions,
	runQuery,
	runMutation,
	type ResultQuery,
	type ResultMutation,
} from "wellcrafted/query";
import { Ok } from "wellcrafted/result";

resultQueryOptions({ queryKey: ["fixture"], queryFn: () => Ok("ready") });
const client = new QueryClient();
const service = { get: () => Ok("ready"), save: (value: string) => Ok(value) };
const queries = resultQueries(["fixture"], { get: service.get });
const writes = resultMutations(["fixture"], { save: service.save });
const query: ResultQuery<readonly ["fixture"], "get", typeof service.get> =
	queries.get;
const write: ResultMutation<readonly ["fixture"], "save", typeof service.save> =
	writes.save;
runQuery(client, query());
runMutation(client, write, "ready");
resultMutationOptions({
	mutationKey: ["fixture", "direct"],
	mutationFn: service.save,
});
