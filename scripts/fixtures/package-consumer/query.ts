import { QueryClient } from "@tanstack/query-core";
import { createQueryFactories, resultQueryOptions } from "wellcrafted/query";
import { Ok } from "wellcrafted/result";

resultQueryOptions({ queryKey: ["fixture"], queryFn: () => Ok("ready") });
createQueryFactories(new QueryClient()).defineQuery({
	queryKey: ["fixture"],
	queryFn: () => Ok("ready"),
});
