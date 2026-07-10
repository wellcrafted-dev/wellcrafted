import { QueryClient } from "@tanstack/query-core";
import { defineErrors } from "wellcrafted/error";
import {
	createQueryFactories,
	defineKeys,
	resultMutationOptions,
	resultQueryOptions,
} from "wellcrafted/query";
import { Ok } from "wellcrafted/result";

const TodoError = defineErrors({
	NotFound: ({ todoId }: { todoId: string }) => ({
		message: `No todo exists with id "${todoId}".`,
		todoId,
	}),
});

const todoKeys = defineKeys({
	all: ["todos"],
	detail: (todoId: string) => ["todos", todoId] as const,
});

const directQuery = resultQueryOptions({
	queryKey: todoKeys.detail("todo-1"),
	queryFn: () => Ok({ id: "todo-1", title: "Write docs" }),
});

const directMutation = resultMutationOptions({
	mutationKey: ["todos", "rename"],
	mutationFn: ({ todoId, title }: { todoId: string; title: string }) =>
		Ok({ id: todoId, title }),
});

const { defineMutation, defineQuery } = createQueryFactories(new QueryClient());
const todoQuery = defineQuery({
	queryKey: todoKeys.detail("todo-1"),
	queryFn: () => Ok({ id: "todo-1", title: "Write docs" }),
});
const renameTodo = defineMutation({
	mutationKey: ["todos", "rename"],
	mutationFn: ({ todoId, title }: { todoId: string; title: string }) => {
		if (todoId === "missing") return TodoError.NotFound({ todoId });
		return Ok({ id: todoId, title });
	},
});

directQuery.queryKey;
directMutation.mutationKey;
todoQuery.options;
todoQuery.fetch;
todoQuery.ensure;
renameTodo.options;
renameTodo({ todoId: "todo-1", title: "Ship docs" });
