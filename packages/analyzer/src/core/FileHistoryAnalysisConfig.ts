import type { OperationStatement } from "../operations/OperationStatement.js"

export class FileHistoryAnalysisConfig {
  /** A path to commit history file */
  importPath: string = "../git-history.txt"

  /** An optional list of regex expressions used to ignore commits from contributors */
  ignoreContributors: string[] = []

  /** An optional list of regex expressions used to detect bots */
  bots: string[] = [".*\\[bot\\].*", ".*[-]bot[@].*"]

  /** If true, contributor IDs (e.g. emails) will be replaced with anonymous IDs */
  anonymizeContributors: boolean = false

  /** An optional list of string transformations used to transform contributor IDs */
  transformContributorEmails: OperationStatement[] = []
}
