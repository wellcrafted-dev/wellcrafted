import { describe, expect, test } from "bun:test";
import { defineErrors, extractErrorMessage } from "../error/index.js";
import { createLogger } from "./create-logger.js";
import { memorySink } from "./memory-sink.js";

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

describe("createLogger", () => {
	test("emits events through the sink", () => {
		const { sink, events } = memorySink();
		const log = createLogger("testsrc", sink);
		log.info("hello", { foo: 1 });
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			level: "info",
			source: "testsrc",
			message: "hello",
			data: { foo: 1 },
		});
		expect(typeof events[0]!.ts).toBe("number");
	});

	test("all 5 levels emit with correct level tag", () => {
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		log.trace("t");
		log.debug("d");
		log.info("i");
		log.warn(TestError.Bad({ path: "/tmp" }));
		log.error(TestError.Boom({ cause: new Error("x") }));
		expect(events.map((e) => e.level)).toEqual([
			"trace",
			"debug",
			"info",
			"warn",
			"error",
		]);
	});

	test("warn/error unwrap the Err wrapper returned by defineErrors factories", () => {
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		const errWrapped = TestError.Bad({ path: "/tmp/a" });
		log.warn(errWrapped);
		expect(events[0]!.data).toBe(errWrapped.error);
		expect(events[0]!.message).toBe("bad at /tmp/a");
	});

	test("warn/error accept raw tagged error (e.g. result.error)", () => {
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		const raw = TestError.Bad({ path: "/tmp/b" }).error;
		log.warn(raw);
		expect(events[0]!.data).toBe(raw);
	});

	test("source is carried on every event", () => {
		const { sink, events } = memorySink();
		const log = createLogger("my-source", sink);
		log.info("x");
		log.warn(TestError.Bad({ path: "/p" }));
		expect(events.every((e) => e.source === "my-source")).toBe(true);
	});

	test("defaults to consoleSink when no sink supplied (smoke)", () => {
		const log = createLogger("default-sink-test");
		expect(() => log.info("visible in console")).not.toThrow();
	});
});
