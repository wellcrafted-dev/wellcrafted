/**
 * Verifies console method routing and structured payload rendering.
 * Trace-level events must not request an additional console stack trace.
 */
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";
import { consoleSink } from "./console-sink.js";
import type { LogLevel } from "./types.js";

const levels: LogLevel[] = ["debug", "info", "warn", "error"];

afterEach(() => mock.restore());

describe("consoleSink", () => {
	test.each(levels)("routes %s to the matching console method", (level) => {
		const spy = spyOn(console, level).mockImplementation(() => {});
		consoleSink({ ts: 0, level, source: "s", message: "m" });
		expect(spy).toHaveBeenCalledTimes(1);
		expect(spy).toHaveBeenCalledWith("[s]", "m");
	});

	test("renders trace through debug without requesting a stack trace", () => {
		const debug = spyOn(console, "debug").mockImplementation(() => {});
		const trace = spyOn(console, "trace").mockImplementation(() => {});
		consoleSink({ ts: 0, level: "trace", source: "s", message: "m" });
		expect(debug).toHaveBeenCalledWith("[s]", "m");
		expect(trace).not.toHaveBeenCalled();
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
	});

	test("omits data arg when undefined", () => {
		const spy = spyOn(console, "info").mockImplementation(() => {});
		consoleSink({ ts: 0, level: "info", source: "s", message: "m" });
		expect(spy).toHaveBeenCalledWith("[s]", "m");
	});
});
