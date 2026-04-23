import { describe, expect, test } from "bun:test";
import { composeSinks } from "./compose-sinks.js";
import { createLogger } from "./create-logger.js";
import { memorySink } from "./memory-sink.js";
import type { LogEvent, LogSink } from "./types.js";

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

	test("forwards disposal to members that implement it", async () => {
		let disposed = 0;
		const owning: LogSink = Object.assign(((_e: LogEvent) => {}) as LogSink, {
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
