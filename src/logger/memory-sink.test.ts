import { describe, expect, test } from "bun:test";
import { memorySink } from "./memory-sink.js";

describe("memorySink", () => {
	test("captures events in order", () => {
		const { sink, events } = memorySink();
		sink({ ts: 1, level: "info", source: "s", message: "a" });
		sink({ ts: 2, level: "warn", source: "s", message: "b" });
		expect(events).toHaveLength(2);
		expect(events.map((e) => e.message)).toEqual(["a", "b"]);
	});

	test("each factory call produces isolated state", () => {
		const a = memorySink();
		const b = memorySink();
		a.sink({ ts: 1, level: "info", source: "a", message: "only-a" });
		expect(a.events).toHaveLength(1);
		expect(b.events).toHaveLength(0);
	});
});
