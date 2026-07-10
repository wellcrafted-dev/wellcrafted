import { resultQueryOptions } from "wellcrafted/query";
import { Ok } from "wellcrafted/result";

resultQueryOptions({ queryKey: ["fixture"], queryFn: () => Ok("ready") });
