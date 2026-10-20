/**
 * Verifies ordered fanout, independent delivery, and existing disposal forwarding.
 * A failed destination must not prevent another destination from receiving an event.
 */
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { composeSinks } from "./compose-sinks.js";
import { createLogger } from "./create-logger.js";
import { memorySink } from "./memory-sink.js";
import type { LogEvent, LogSink } from "./types.js";

afterEach(() => mock.restore());

describe("composeSinks", () => {
	test("fans out to every sink", () => {
		const a = memorySink();
		const b = memorySink();
		const log = createLogger("s", composeSinks(a.sink, b.sink));
		log.info("x");
		expect(a.events).toHaveLength(1);
		expect(b.events).toHaveLength(1);
	});

	test("zero sinks is a no-op", () => {
		const sink = composeSinks();
		expect(() =>
			sink({ ts: 0, level: "info", source: "s", message: "m" }),
		).not.toThrow();
	});

	test("fans out in declared order", () => {
		const order: string[] = [];
		const a: LogSink = () => {
			order.push("a");
		};
		const b: LogSink = () => {
			order.push("b");
		};
		const c: LogSink = () => {
			order.push("c");
		};
		composeSinks(a, b, c)({ ts: 0, level: "info", source: "s", message: "m" });
		expect(order).toEqual(["a", "b", "c"]);
	});

	test("attempts every destination when earlier destinations throw", () => {
		const output = spyOn(console, "error").mockImplementation(() => {});
		const a = memorySink();
		const b = memorySink();
		const failing: LogSink = () => {
			throw new Error("sink failed");
		};
		const event: LogEvent = {
			ts: 0,
			level: "warn",
			source: "source",
			message: "failure",
		};

		expect(() =>
			composeSinks(failing, a.sink, failing, b.sink)(event),
		).not.toThrow();
		expect(a.events[0]).toBe(event);
		expect(b.events[0]).toBe(event);
		expect(output).toHaveBeenCalledTimes(2);
	});

	test("continues delivery even when the emergency console report throws", () => {
		spyOn(console, "error").mockImplementation(() => {
			throw new Error("console failed");
		});
		const healthy = memorySink();
		const log = createLogger(
			"source",
			composeSinks(() => {
				throw new Error("sink failed");
			}, healthy.sink),
		);
		const result = { name: "Failed", message: "original failure" };

		expect(() => log.error(result)).not.toThrow();
		expect(healthy.events).toHaveLength(1);
		expect(healthy.events[0]?.data).toBe(result);
	});

	test("requires synchronous members and completes receipt before returning", () => {
		const first = memorySink();
		const second = memorySink();
		const composed = composeSinks(first.sink, second.sink);
		const event: LogEvent = {
			ts: 0,
			level: "info",
			source: "source",
			message: "event",
		};

		expect(composed(event)).toBeUndefined();
		expect(first.events[0]).toBe(event);
		expect(second.events[0]).toBe(event);

		// @ts-expect-error Async members are outside the synchronous sink contract.
		composeSinks(async () => {});
		// @ts-expect-error Returning a promise without async is also unsupported.
		composeSinks(() => Promise.resolve());
	});

	test("forwards disposal to members that implement it", async () => {
		let disposed = 0;
		const owning: LogSink = Object.assign((_e: LogEvent): undefined => {}, {
			[Symbol.asyncDispose]: async () => {
				disposed++;
			},
		});
		const plain: LogSink = (_e) => {};
		const composed = composeSinks(plain, owning);
		await composed[Symbol.asyncDispose]?.();
		expect(disposed).toBe(1);
	});
});
