import { describe, expect, spyOn, test } from "bun:test";
import { consoleSink } from "./console-sink.js";
import type { LogLevel } from "./types.js";

const levels: LogLevel[] = ["trace", "debug", "info", "warn", "error"];

describe("consoleSink", () => {
	test.each(levels)("routes %s to console.%s", (level) => {
		const spy = spyOn(console, level).mockImplementation(() => {});
		consoleSink({ ts: 0, level, source: "s", message: "m" });
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith("[s]", "m");
		spy.mockRestore();
	});

	test("appends data arg when present", () => {
		const spy = spyOn(console, "info").mockImplementation(() => {});
		consoleSink({
			ts: 0,
			level: "info",
			source: "s",
			message: "m",
			data: { k: 1 },
		});
		expect(spy).toHaveBeenCalledWith("[s]", "m", { k: 1 });
		spy.mockRestore();
	});

	test("omits data arg when undefined", () => {
		const spy = spyOn(console, "info").mockImplementation(() => {});
		consoleSink({ ts: 0, level: "info", source: "s", message: "m" });
		expect(spy).toHaveBeenCalledWith("[s]", "m");
		spy.mockRestore();
	});
});
