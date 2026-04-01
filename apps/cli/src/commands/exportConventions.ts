import { writeFileSync } from "node:fs";
import { Command } from "@effect/cli";
import { ScopingConventions } from "@planetnik/analyzer";
import { Effect } from "effect";

export const exportConventionsCommand = Command.make(
	"exportConventions",
	{},
	() =>
		Effect.gen(function* () {
			const conventions = {
				testFilesConventions: ScopingConventions.testConventions(),
				generatedFilesConventions: ScopingConventions.generatedConventions(),
				buildAndDeploymentFilesConventions:
					ScopingConventions.buildAndDeploymentConventions(),
				ignoredFilesConventions: ScopingConventions.ignoreConventions(),
			};

			const file = "standard_analysis_conventions.json";
			writeFileSync(file, JSON.stringify(conventions, null, 2), "utf-8");
			yield* Effect.log(`Standard conventions saved to '${file}'.`);
		}),
);
