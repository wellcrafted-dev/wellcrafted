import { defineErrors, type InferErrors } from "wellcrafted/error";
import { Ok, type Result } from "wellcrafted/result";
import { assertEqual } from "./assert.js";

const PortError = defineErrors({
	Invalid: ({ input }: { input: string }) => ({
		message: `Expected a port from 1 to 65535, received "${input}".`,
		input,
	}),
});

type PortError = InferErrors<typeof PortError>;

function parsePort(input: string): Result<number, PortError> {
	const port = Number(input);
	if (!Number.isInteger(port) || port < 1 || port > 65_535) {
		return PortError.Invalid({ input });
	}

	return Ok(port);
}

const success = parsePort("3000");
assertEqual(success, { data: 3000, error: null });

const failure = parsePort("not-a-port");
assertEqual(failure.data, null);
assertEqual(failure.error?.name, "Invalid");

console.log("quick-start: success and failure paths passed");
