// docs:snippet quick-start:start

import { defineErrors, type InferErrors } from "wellcrafted/error";
import { Ok, type Result } from "wellcrafted/result";

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
if (success.error !== null) {
	console.error(success.error.message);
} else {
	console.log(`Listening on port ${success.data}.`);
}

const failure = parsePort("not-a-port");
if (failure.error !== null) {
	console.error(failure.error.message);
}

// docs:snippet quick-start:end

if (success.data !== 3000 || success.error !== null) {
	throw new Error("Expected the valid port to succeed.");
}

if (failure.data !== null || failure.error?.name !== "Invalid") {
	throw new Error("Expected the invalid port to fail.");
}

console.log("quick-start: success and failure paths passed");
