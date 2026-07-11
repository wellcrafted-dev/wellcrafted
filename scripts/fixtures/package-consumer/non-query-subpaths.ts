import type { Brand } from "wellcrafted/brand";
import { defineErrors } from "wellcrafted/error";
import { once } from "wellcrafted/function";
import { parseJson } from "wellcrafted/json";
import { composeSinks, memorySink } from "wellcrafted/logger";
import { Ok, partitionResults } from "wellcrafted/result";
import { OkSchema } from "wellcrafted/standard-schema";
import { expectOk } from "wellcrafted/testing";

type FixtureId = string & Brand<"FixtureId">;
const id = "fixture-1" as FixtureId;
const FixtureError = defineErrors({
	Missing: () => ({ message: "Fixture is missing." }),
});

expectOk(Ok(id));
parseJson('{"ready":true}');
partitionResults([Ok(1), FixtureError.Missing()]);
once(() => id)();
composeSinks(memorySink().sink);
OkSchema({
	"~standard": {
		version: 1,
		vendor: "fixture",
		types: undefined as unknown as { input: string; output: string },
	},
});
