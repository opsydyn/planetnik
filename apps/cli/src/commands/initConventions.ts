import { writeFileSync } from "node:fs"
import { Effect } from "effect"
import { Command } from "effect/cli"

export const initConventionsCommand = Command.make("initConventions", {}, () =>
  Effect.gen(function* () {
    const emptyConventions = {
      ignoreStandardScopingConventions: false,
      ignoreStandardControls: false,
      removeStandardConcerns: false,
      testFilesConventions: [],
      generatedFilesConventions: [],
      buildAndDeploymentFilesConventions: [],
      ignoredFilesConventions: [],
      otherFilesConventions: [],
      concerns: [],
      goalsAndControls: [],
      ignoreContributors: [],
      bots: [],
      tagRules: [],
    }

    const file = "analysis_conventions.json"
    writeFileSync(file, JSON.stringify(emptyConventions, null, 2), "utf-8")
    yield* Effect.log(`New conventions file saved to '${file}'.`)
  }),
)
