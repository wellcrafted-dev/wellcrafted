import { defineConfig } from "tsdown";

export default defineConfig({
	entry: [
		"src/result/index.ts",
		"src/error/index.ts",
		"src/brand.ts",
		"src/query/index.ts",
		"src/standard-schema/index.ts",
	],
	format: ["esm"],
	target: "esnext",
	dts: true,
});
