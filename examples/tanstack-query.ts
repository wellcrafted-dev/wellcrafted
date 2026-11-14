// docs:snippet tanstack-query:start
import { MutationCache, QueryClient } from "@tanstack/query-core";
import { defineErrors } from "wellcrafted/error";
import {
	resultMutations,
	resultQueries,
	resultMutationOptions,
	resultQueryOptions,
	runMutation,
	runQuery,
} from "wellcrafted/query";
import { Ok } from "wellcrafted/result";

const TodoError = defineErrors({
	NotFound: ({ todoId }: { todoId: string }) => ({
		message: `No todo exists with id "${todoId}".`,
		todoId,
	}),
});
const service = {
	get: (todoId: string) =>
		todoId === "missing"
			? TodoError.NotFound({ todoId })
			: Ok({ id: todoId, title: "Write docs" }),
	rename: ({ todoId, title }: { todoId: string; title: string }) =>
		Ok({ id: todoId, title }),
};

const todos = resultQueries(["todos"], { get: service.get });
const writes = resultMutations(["todos"], { rename: service.rename });
const client = new QueryClient({
	defaultOptions: {
		queries: { retry: false, gcTime: 0 },
		mutations: { gcTime: 0 },
	},
	mutationCache: new MutationCache({
		onSettled: (_data, _error, _variables, _rollback, _mutation, { client }) =>
			client.invalidateQueries(),
	}),
});

const directQuery = resultQueryOptions({
	queryKey: ["todo-detail", "todo-1"],
	queryFn: () => service.get("todo-1"),
});
const directMutation = resultMutationOptions({
	mutationKey: ["todo-rename"],
	mutationFn: service.rename,
});
const loaded = await runQuery(client, todos.get("todo-1"));
if (loaded.error !== null) throw loaded.error;
await runMutation(client, writes.rename, {
	todoId: loaded.data.id,
	title: "Ship docs",
});

todos.get.key; // ["todos", "get"]
todos.get("todo-1").queryKey; // ["todos", "get", ["todo-1"]]
directQuery.queryKey;
directMutation.mutationKey;
client.clear();
// docs:snippet tanstack-query:end
