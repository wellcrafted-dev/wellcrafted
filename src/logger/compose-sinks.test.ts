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
