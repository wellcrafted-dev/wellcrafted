/**
 * Verifies structured error identity, source binding, and delivery isolation.
 * Sink failures must be reported without interrupting the calling operation.
 */
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { defineErrors, extractErrorMessage } from "../error/index.js";
import { createLogger } from "./create-logger.js";
import { memorySink } from "./memory-sink.js";
import type { LogLevel } from "./types.js";

afterEach(() => mock.restore());

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
		expect(typeof events[0]?.ts).toBe("number");
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
		expect(events[0]?.data).toBe(errWrapped.error);
		expect(events[0]?.message).toBe("bad at /tmp/a");
	});

	test("warn/error accept raw tagged error (e.g. result.error)", () => {
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		const raw = TestError.Bad({ path: "/tmp/b" }).error;
		log.warn(raw);
		expect(events[0]?.data).toBe(raw);
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

	test("warn/error accept a native Error instance", () => {
		// Plain Error satisfies AnyTaggedError structurally (name + message),
		// so migration from `console.warn(err)` works without a tagged wrapper.
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		const native = new Error("boom");
		log.warn(native);
		expect(events[0]?.message).toBe("boom");
		expect(events[0]?.data).toBe(native);
	});

	test("methods are callable when detached from the logger (no `this`)", () => {
		// Pins the contract that `tapErr(log.warn)` relies on: methods close
		// over sink/source, never reference `this`.
		const { sink, events } = memorySink();
		const log = createLogger("s", sink);
		const { info, warn } = log;
		info("hello");
		warn(TestError.Bad({ path: "/p" }));
		expect(events).toHaveLength(2);
		expect(events[0]?.message).toBe("hello");
		expect(events[1]?.level).toBe("warn");
	});

	test.each<LogLevel>(["trace", "debug", "info", "warn", "error"])(
		"a throwing sink cannot interrupt a %s call",
		(level) => {
			const failure = new Error("sink failed");
			const output = spyOn(console, "error").mockImplementation(() => {});
			const sink = mock(() => {
				throw failure;
			});
			const log = createLogger("source", sink);

			expect(() => {
				if (level === "warn" || level === "error") {
					log[level](TestError.Bad({ path: "/document" }));
				} else {
					log[level]("event");
				}
			}).not.toThrow();
			expect(sink).toHaveBeenCalledTimes(1);
			expect(output).toHaveBeenCalledTimes(1);
			expect(output).toHaveBeenCalledWith(
				"[wellcrafted/logger] Sink failed",
				failure,
				expect.objectContaining({ source: "source", level }),
			);
		},
	);

	test("requires a synchronous receiver that returns no value", () => {
		let received = false;
		const log = createLogger("source", () => {
			received = true;
		});
		expect(log.info("event")).toBeUndefined();
		expect(received).toBe(true);

		// @ts-expect-error Async receivers are outside the synchronous sink contract.
		createLogger("async", async () => {});
		// @ts-expect-error A returned promise is not synchronous receipt.
		createLogger("promise", () => Promise.resolve());
		// @ts-expect-error Receivers cannot return another kind of value either.
		createLogger("value", () => 1);
	});

	test("a failing emergency console report cannot escape the logger", () => {
		const output = spyOn(console, "error").mockImplementation(() => {
			throw new Error("console failed");
		});
		const log = createLogger("source", () => {
			throw new Error("sink failed");
		});

		expect(() => log.warn(TestError.Bad({ path: "/document" }))).not.toThrow();
		expect(output).toHaveBeenCalledTimes(1);
	});
});
