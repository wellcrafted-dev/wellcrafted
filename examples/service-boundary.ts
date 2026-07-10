/**
 * Adapted from Epicenter's service-boundary pattern at commit 4d438c0:
 * https://github.com/EpicenterHQ/epicenter/blob/4d438c0/packages/client/src/transcribe.ts
 */
import {
	defineErrors,
	extractErrorMessage,
	type InferErrors,
} from "wellcrafted/error";
import { Ok, type Result, trySync } from "wellcrafted/result";
import { assertEqual } from "./assert.js";

const UserError = defineErrors({
	ReadFailed: ({ cause }: { cause: string }) => ({
		message: `Could not read the user record: ${cause}`,
		cause,
	}),
	NotFound: ({ userId }: { userId: string }) => ({
		message: `No user exists with id "${userId}".`,
		userId,
	}),
});

type UserError = InferErrors<typeof UserError>;
type User = { id: string; displayName: string };

function createUserService({ records }: { records: Map<string, User> }) {
	function findUser(userId: string): Result<User | null, UserError> {
		return trySync({
			try: () => {
				if (userId === "storage-offline") {
					throw new Error("storage is offline");
				}
				return records.get(userId) ?? null;
			},
			catch: (cause) =>
				UserError.ReadFailed({ cause: extractErrorMessage(cause) }),
		});
	}

	return {
		getDisplayName(userId: string): Result<string, UserError> {
			const userResult = findUser(userId);
			if (userResult.error !== null) return userResult;
			if (userResult.data === null) return UserError.NotFound({ userId });

			return Ok(userResult.data.displayName);
		},
	};
}

const users = createUserService({
	records: new Map([["user-1", { id: "user-1", displayName: "Ada" }]]),
});

assertEqual(users.getDisplayName("user-1"), {
	data: "Ada",
	error: null,
});
assertEqual(users.getDisplayName("missing").error?.name, "NotFound");
assertEqual(users.getDisplayName("storage-offline").error?.name, "ReadFailed");

console.log("service-boundary: success, domain, and I/O failures passed");
