import { describe, expect, test } from "bun:test";
import { defineErrors, extractErrorMessage } from "../error/index.js";
import { tryAsync } from "../result/index.js";
import { createLogger } from "./create-logger.js";
import { memorySink } from "./memory-sink.js";
import { tapErr } from "./tap-err.js";

const TestError = defineErrors({
	Boom: ({ cause }: { cause: unknown }) => ({
		message: `boom: ${extractErrorMessage(cause)}`,
		cause,
	}),
	Bad: ({ path }: { path: string }) => ({
		message: `bad at ${path}`,
		path,
	}),
});

describe("tapErr", () => {
	test("logs on error branch and returns the Result unchanged", async () => {
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		const result = await tryAsync({
			try: async () => {
				throw new Error("nope");
			},
			catch: (cause) => TestError.Boom({ cause }),
		}).then(tapErr(log.warn));
		expect(result.error).toBeDefined();
		expect(events).toHaveLength(1);
		expect(events[0]!.level).toBe("warn");
		expect(events[0]!.data).toBe(result.error);
	});

	test("passes through Ok without logging", async () => {
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		const result = await tryAsync({
			try: async () => 42,
			catch: (cause) => TestError.Boom({ cause }),
		}).then(tapErr(log.warn));
		expect(result.data).toBe(42);
		expect(events).toHaveLength(0);
	});

	test("accepts either .warn or .error as the level", () => {
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		tapErr(log.error)(TestError.Bad({ path: "/p" }));
		expect(events[0]!.level).toBe("error");
	});
});
