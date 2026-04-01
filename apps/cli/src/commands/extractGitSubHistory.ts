import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { Command, Options } from "@effect/cli";
import { Effect } from "effect";

const GIT_HISTORY_FILE = "git-history.txt";

const analysisRoot = Options.text("analysisRoot").pipe(
	Options.withDefault("."),
);
const prefix = Options.text("prefix");

export function extractSubHistoryLines(
	lines: string[],
	pathPrefix: string,
): string[] {
	const result: string[] = [];
	for (const line of lines) {
		const parts = line.split(" ");
		if (parts.length >= 4) {
			const path = parts[3]!;
			if (path.startsWith(pathPrefix)) {
				// Remove the prefix from the path
				let newPath = path.substring(pathPrefix.length);
				if (newPath.startsWith("/")) newPath = newPath.substring(1);
				parts[3] = newPath;
				result.push(parts.join(" "));
			}
		}
	}
	return result;
}

export const extractGitSubHistoryCommand = Command.make(
	"extractGitSubHistory",
	{ analysisRoot, prefix },
	(args) =>
		Effect.gen(function* () {
			const root = resolve(args.analysisRoot);
			if (!existsSync(root)) {
				yield* Effect.logError(`The analysis root "${root}" does not exist.`);
				return;
			}

			const historyFile = join(root, GIT_HISTORY_FILE);
			if (!existsSync(historyFile)) {
				yield* Effect.logError(
					`Git history file "${historyFile}" does not exist.`,
				);
				return;
			}

			yield* Effect.log(
				`Extracting sub-history for prefix "${args.prefix}"...`,
			);

			const content = readFileSync(historyFile, "utf-8");
			const lines = content.split("\n");
			const filtered = extractSubHistoryLines(lines, args.prefix);

			const outputDir = join(root, args.prefix);
			mkdirSync(outputDir, { recursive: true });
			const outputFile = join(outputDir, GIT_HISTORY_FILE);
			writeFileSync(outputFile, filtered.join("\n"), "utf-8");

			yield* Effect.log(
				`Extracted ${filtered.length} entries to ${outputFile}`,
			);
		}),
);
