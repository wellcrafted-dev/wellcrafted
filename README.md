# wellcrafted

[![npm version](https://badge.fury.io/js/wellcrafted.svg)](https://www.npmjs.com/package/wellcrafted)

wellcrafted defines expected errors as plain, boundary-friendly data that can move through JSON, HTTP, workers, IPC, logs, and UI when every field is JSON-compatible. Its familiar `{ data, error }` Result shape makes that data ergonomic to return and handle in ordinary TypeScript.

`defineErrors` does not type-enforce JSON-compatible fields, and arbitrary fields do not serialize perfectly. The boundary-friendly promise applies only when the complete error value contains JSON-compatible data. Runtime validation and end-to-end static typing are separate concerns.

wellcrafted is an error-handling library for TypeScript application authors. Define named failure variants as objects, return them through Results, and handle them with `async/await`, early returns, exact checks, and `switch`.

## Install

```bash
npm install wellcrafted
```

wellcrafted has no root export. Import from a published subpath such as `wellcrafted/error` or `wellcrafted/result`. See the [installation guide](docs/start/installation.mdx) for every subpath and the tested compiler and runtime matrix.

## Quick start

Define the failures a function can return, then use the Result shape to handle both outcomes.

<!-- docs:quick-start:start -->
```typescript quick-start.ts
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
```
<!-- docs:quick-start:end -->

The example is extracted from the checked [`examples/quick-start.ts`](examples/quick-start.ts) source. The documentation checks compare both copies with that file so they cannot drift unnoticed.

`PortError.Invalid({ input })` returns an `Err` directly. The tagged body is under `.error`, while `InferErrors<typeof PortError>` derives the union of every variant for the function signature. `Ok(port)` returns the other half of the union.

The exact `error !== null` check narrows both fields. A shorter `if (error)` is fine for object errors created by `defineErrors`, but it is not a universal Result check because the current `Err<E>` type permits falsy values such as `0` and `""`.

Run the canonical success and failure paths with Bun:

```bash
bun run docs:examples
```

## Errors at application boundaries

Named object variants let an application use the same error vocabulary in a service return type, a JSON-compatible HTTP payload, a structured log, and UI branching. There is no error-class transformation layer when the complete value is already JSON-compatible.

That condition matters. A `Date`, native `Error`, `bigint`, function, class instance, `undefined`, or cyclic value does not have an exact JSON round trip. `defineErrors` accepts those fields because serializability is a convention, not a type constraint. Validate untrusted wire data separately; preserving `{ data, error }` does not prove its payload types.

The checked [service-boundary example](examples/service-boundary.ts) shows a narrow throwing boundary, a named domain failure, and manual propagation. It is adapted from [Epicenter's transcription service at commit `4d438c0`](https://github.com/EpicenterHQ/epicenter/blob/4d438c0/packages/client/src/transcribe.ts).

## The tradeoff

wellcrafted keeps control flow visible. There is no `?` operator or automatic short-circuiting, so each propagation step is an explicit early return. It also does not provide dependency injection, structured concurrency, or resource management.

If an application needs those capabilities across many layers, use an effect system such as [Effect](https://effect.website). wellcrafted is for the smaller job: typed expected failures as data, handled with ordinary TypeScript.

## Documentation

- [Install wellcrafted](docs/start/installation.mdx)
- [Run the quick start](docs/start/quick-start.mdx)
- [Migrate one throwing boundary](docs/start/migrating-from-try-catch.mdx)
- [Contribute to wellcrafted](CONTRIBUTING.md)

## Agent skills

As an optional convenience, the repository includes distributable skills for coding agents that teach wellcrafted's core patterns. Install them with `npx skills add wellcrafted-dev/wellcrafted`; the library and documentation do not depend on them.
