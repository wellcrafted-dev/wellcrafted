import { strict as assert } from "node:assert";
import * as brand from "wellcrafted/brand";
import { defineErrors } from "wellcrafted/error";
import { once } from "wellcrafted/function";
import { parseJson } from "wellcrafted/json";
import { composeSinks, createLogger, memorySink } from "wellcrafted/logger";
import { resultQueryOptions } from "wellcrafted/query";
import { Err, Ok, partitionResults } from "wellcrafted/result";
import { OkSchema } from "wellcrafted/standard-schema";
import { expectErr, expectOk } from "wellcrafted/testing";

assert.deepEqual(Object.keys(brand), []);

const FixtureError = defineErrors({
	Missing: () => ({ message: "Fixture is missing." }),
});
assert.equal(FixtureError.Missing().error.name, "Missing");

const incrementOnce = once(() => 1);
assert.equal(incrementOnce(), 1);
assert.equal(incrementOnce(), 1);

assert.deepEqual(parseJson('{"ready":true}').data, { ready: true });

let disposed = false;
const disposableSink = Object.assign(() => {}, {
	[Symbol.asyncDispose]: async () => {
		disposed = true;
	},
});
const { sink, events } = memorySink();
const composed = composeSinks(sink, disposableSink);
createLogger("runtime/fixture", composed).info("loaded");
assert.equal(events.length, 1);
await composed[Symbol.asyncDispose]();
assert.equal(disposed, true);

const options = resultQueryOptions({
	queryKey: ["runtime", "fixture"],
	queryFn: () => Ok("ready"),
});
assert.equal(await options.queryFn({}), "ready");

const { oks, errs } = partitionResults([Ok(1), Err("failure"), Ok(2)]);
assert.deepEqual(
	oks.map((result) => result.data),
	[1, 2],
);
assert.deepEqual(
	errs.map((result) => result.error),
	["failure"],
);

const stringSchema = {
	"~standard": {
		version: 1,
		vendor: "fixture",
		validate: (value) =>
			typeof value === "string"
				? { value }
				: { issues: [{ message: "Expected a string" }] },
	},
};
const okSchema = OkSchema(stringSchema);
assert.deepEqual(okSchema["~standard"].validate(Ok("ready")), {
	value: Ok("ready"),
});

assert.equal(expectOk(Ok("ready")), "ready");
assert.equal(expectErr(Err("failure")), "failure");

await assert.rejects(import("wellcrafted"), (error) => {
	return (
		error?.code === "ERR_PACKAGE_PATH_NOT_EXPORTED" ||
		error?.code === "ERR_MODULE_NOT_FOUND"
	);
});

console.log("runtime fixture: all nine subpaths passed; root import rejected");
