import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { Command, Options } from "@effect/cli";
import { Effect } from "effect";
import { extractGitHistory } from "../git/GitHistoryExtractor.js";

const srcRoot = Options.text("srcRoot").pipe(Options.withDefault("."));

export const extractGitHistoryCommand = Command.make(
	"extractGitHistory",
	{ srcRoot },
	(args) =>
		Effect.gen(function* () {
			const root = resolve(args.srcRoot);
			if (!existsSync(root)) {
				yield* Effect.logError(`The root "${root}" does not exist.`);
				return;
			}

			yield* Effect.log(`Extracting git history from ${root}...`);

			const count = yield* Effect.tryPromise({
				try: () => extractGitHistory(root),
				catch: (error) => new Error(`Git history extraction failed: ${error}`),
			});

			yield* Effect.log(`Extracted ${count} file change entries.`);
		}),
);
