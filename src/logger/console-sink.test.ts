import { describe, expect, test } from "bun:test";
import { consoleSink } from "./console-sink.js";
import type { LogEvent } from "./types.js";

describe("consoleSink", () => {
	test("routes every level without throwing (smoke)", () => {
		const levels: LogEvent["level"][] = [
			"trace",
			"debug",
			"info",
			"warn",
			"error",
		];
		for (const level of levels) {
			expect(() =>
				consoleSink({ ts: 0, level, source: "s", message: "m" }),
			).not.toThrow();
		}
	});

	test("omits data from args when undefined", () => {
		// behavioral smoke — no throw with or without data
		expect(() =>
			consoleSink({ ts: 0, level: "info", source: "s", message: "no-data" }),
		).not.toThrow();
		expect(() =>
			consoleSink({
				ts: 0,
				level: "info",
				source: "s",
				message: "with-data",
				data: { k: 1 },
			}),
		).not.toThrow();
	});
});
