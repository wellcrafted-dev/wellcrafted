import { assertEqual } from "./assert.js";

// docs:snippet serialization-boundary:start
import { defineErrors } from "wellcrafted/error";

const UploadError = defineErrors({
	Rejected: ({
		fileName,
		reasons,
	}: {
		fileName: string;
		reasons: string[];
	}) => ({
		message: `Upload rejected for "${fileName}".`,
		fileName,
		reasons,
	}),
	Unexpected: ({ cause }: { cause: unknown }) => ({
		message: "Upload failed unexpectedly.",
		cause,
	}),
});

const boundaryFriendly = UploadError.Rejected({
	fileName: "report.csv",
	reasons: ["too large", "unsupported encoding"],
});

// defineErrors does not enforce JSON-safe fields. A native Error is accepted,
// but its non-enumerable details do not survive JSON serialization.
const withNativeCause = UploadError.Unexpected({
	cause: new Error("disk full"),
});
const roundTripped = JSON.parse(JSON.stringify(withNativeCause)) as {
	error: { cause: unknown };
};
// docs:snippet serialization-boundary:end

assertEqual(JSON.parse(JSON.stringify(boundaryFriendly)), boundaryFriendly);
assertEqual(roundTripped.error.cause, {});

console.log(
	"serialization-boundary: JSON-compatible data and cause caveat passed",
);
