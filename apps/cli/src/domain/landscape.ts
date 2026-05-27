import { Data, Schema } from "effect";

// ---------------------------------------------------------------------------
// Branded types
// ---------------------------------------------------------------------------

/** Compound key: `org/repo` — identifies a repository within a landscape. */
export const RepoKey = Schema.String.pipe(
	Schema.pattern(/^[^/]+\/[^/]+$/),
	Schema.brand("RepoKey"),
);
export type RepoKey = typeof RepoKey.Type;

/** Absolute filesystem path to a resolved configuration file. */
export const ConfigPath = Schema.String.pipe(
	Schema.minLength(1),
	Schema.brand("ConfigPath"),
);
export type ConfigPath = typeof ConfigPath.Type;

// ---------------------------------------------------------------------------
// Domain errors — RFC 9457 Problem Details structure
// ---------------------------------------------------------------------------

/** Git clone operation failed for a repository. */
export class CloneError extends Data.TaggedError("CloneError")<{
	readonly type: "landscape/clone";
	readonly title: "Repository clone failed";
	readonly detail: string;
	readonly repoKey: string;
}> {
	get message() { return `${this.title} [${this.repoKey}]: ${this.detail}` }
}

/** Git history extraction failed for a repository. */
export class GitHistoryError extends Data.TaggedError("GitHistoryError")<{
	readonly type: "landscape/git-history";
	readonly title: "Git history extraction failed";
	readonly detail: string;
	readonly repoKey: string;
}> {
	get message() { return `${this.title} [${this.repoKey}]: ${this.detail}` }
}

/** Analysis config was not created after scope initialisation. */
export class ConfigNotFoundError extends Data.TaggedError(
	"ConfigNotFoundError",
)<{
	readonly type: "landscape/config-not-found";
	readonly title: "Analysis config file not created";
	readonly detail: string;
	readonly repoKey: string;
}> {
	get message() { return `${this.title} [${this.repoKey}]: ${this.detail}` }
}

/** GitHub API discovery call failed. */
export class GitHubDiscoveryError extends Data.TaggedError(
	"GitHubDiscoveryError",
)<{
	readonly type: "landscape/github-discovery";
	readonly title: "GitHub API discovery failed";
	readonly detail: string;
	readonly org: string;
}> {
	get message() { return `${this.title}: ${this.detail}` }
}

/** Catch-all for unexpected errors inside a repo worker. */
export class UnknownWorkerError extends Data.TaggedError("UnknownWorkerError")<{
	readonly type: "landscape/unknown";
	readonly title: "Unexpected worker error";
	readonly detail: string;
	readonly repoKey: string;
}> {
	get message() { return `${this.title} [${this.repoKey}]: ${this.detail}` }
}

/** Dependabot alert fetch failed for an org/repo. */
export class DependabotFetchError extends Data.TaggedError(
	"DependabotFetchError",
)<{
	readonly type: "landscape/dependabot-fetch";
	readonly title: "Dependabot alert fetch failed";
	readonly detail: string;
	readonly repoKey: string;
}> {
	get message() { return `${this.title} [${this.repoKey}]: ${this.detail}` }
}

/** Union of all landscape domain errors. */
export type LandscapeError =
	| CloneError
	| GitHistoryError
	| ConfigNotFoundError
	| GitHubDiscoveryError
	| UnknownWorkerError
	| DependabotFetchError;

// ---------------------------------------------------------------------------
// Result types — tagged outcome union for repo analysis workers
// ---------------------------------------------------------------------------

/** Repository was already analysed and skipped. */
export class RepoAnalysisSkipped extends Data.TaggedClass(
	"RepoAnalysisSkipped",
)<{
	readonly repoKey: string;
	readonly name: string;
}> {}

/** Repository analysis completed successfully. */
export class RepoAnalysisDone extends Data.TaggedClass("RepoAnalysisDone")<{
	readonly repoKey: string;
	readonly name: string;
}> {}

/** Repository analysis failed with a domain error. */
export class RepoAnalysisFailed extends Data.TaggedClass("RepoAnalysisFailed")<{
	readonly repoKey: string;
	readonly name: string;
	readonly error: LandscapeError;
}> {}

/** Discriminated union of all possible worker outcomes. */
export type RepoWorkerOutcome =
	| RepoAnalysisSkipped
	| RepoAnalysisDone
	| RepoAnalysisFailed;
