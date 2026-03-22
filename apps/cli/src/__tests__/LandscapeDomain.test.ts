import { describe, expect, test } from "bun:test"
import { Effect, Schema } from "effect"
import {
  CloneError,
  ConfigNotFoundError,
  ConfigPath,
  GitHistoryError,
  GitHubDiscoveryError,
  RepoAnalysisDone,
  RepoAnalysisFailed,
  RepoAnalysisSkipped,
  RepoKey,
  UnknownWorkerError,
} from "../domain/landscape.js"

describe("RepoKey branded type", () => {
  test("accepts valid org/repo format", () => {
    const key = Schema.decodeSync(RepoKey)("Effect-TS/effect")
    expect(key as string).toBe("Effect-TS/effect")
  })

  test("rejects string without a slash", () => {
    expect(() => Schema.decodeSync(RepoKey)("noslash")).toThrow()
  })

  test("rejects empty string", () => {
    expect(() => Schema.decodeSync(RepoKey)("")).toThrow()
  })

  test("rejects string with only a slash", () => {
    expect(() => Schema.decodeSync(RepoKey)("/")).toThrow()
  })

  test("rejects string with leading slash", () => {
    expect(() => Schema.decodeSync(RepoKey)("/repo")).toThrow()
  })

  test("rejects string with trailing slash", () => {
    expect(() => Schema.decodeSync(RepoKey)("org/")).toThrow()
  })
})

describe("ConfigPath branded type", () => {
  test("accepts non-empty path string", () => {
    const path = Schema.decodeSync(ConfigPath)("/home/user/config.json")
    expect(path as string).toBe("/home/user/config.json")
  })

  test("rejects empty string", () => {
    expect(() => Schema.decodeSync(ConfigPath)("")).toThrow()
  })
})

describe("domain errors carry RFC 9457 fields", () => {
  test("CloneError has correct tag and fields", () => {
    const error = new CloneError({
      type: "landscape/clone",
      title: "Repository clone failed",
      detail: "Connection timed out",
      repoKey: "org/repo",
    })
    expect(error._tag).toBe("CloneError")
    expect(error.type).toBe("landscape/clone")
    expect(error.title).toBe("Repository clone failed")
    expect(error.detail).toBe("Connection timed out")
    expect(error.repoKey).toBe("org/repo")
  })

  test("GitHistoryError has correct tag", () => {
    const error = new GitHistoryError({
      type: "landscape/git-history",
      title: "Git history extraction failed",
      detail: "No commits found",
      repoKey: "org/repo",
    })
    expect(error._tag).toBe("GitHistoryError")
  })

  test("ConfigNotFoundError has correct tag", () => {
    const error = new ConfigNotFoundError({
      type: "landscape/config-not-found",
      title: "Analysis config file not created",
      detail: "Expected config at /tmp/config.json",
      repoKey: "org/repo",
    })
    expect(error._tag).toBe("ConfigNotFoundError")
  })

  test("GitHubDiscoveryError carries org field", () => {
    const error = new GitHubDiscoveryError({
      type: "landscape/github-discovery",
      title: "GitHub API discovery failed",
      detail: "Rate limited",
      org: "Effect-TS",
    })
    expect(error._tag).toBe("GitHubDiscoveryError")
    expect(error.org).toBe("Effect-TS")
  })

  test("UnknownWorkerError has correct tag", () => {
    const error = new UnknownWorkerError({
      type: "landscape/unknown",
      title: "Unexpected worker error",
      detail: "Something unexpected",
      repoKey: "org/repo",
    })
    expect(error._tag).toBe("UnknownWorkerError")
  })

  test("tagged errors are catchable by tag in Effect", async () => {
    const failing = Effect.fail(
      new CloneError({
        type: "landscape/clone",
        title: "Repository clone failed",
        detail: "timeout",
        repoKey: "org/repo",
      }),
    )

    const recovered = failing.pipe(Effect.catchTag("CloneError", (e) => Effect.succeed(`caught: ${e.detail}`)))

    const result = await Effect.runPromise(recovered)
    expect(result).toBe("caught: timeout")
  })
})

describe("result types", () => {
  test("RepoAnalysisDone has correct tag", () => {
    const result = new RepoAnalysisDone({ repoKey: "org/repo", name: "repo" })
    expect(result._tag).toBe("RepoAnalysisDone")
    expect(result.repoKey).toBe("org/repo")
    expect(result.name).toBe("repo")
  })

  test("RepoAnalysisSkipped has correct tag", () => {
    const result = new RepoAnalysisSkipped({ repoKey: "org/repo", name: "repo" })
    expect(result._tag).toBe("RepoAnalysisSkipped")
  })

  test("RepoAnalysisFailed carries typed error", () => {
    const error = new CloneError({
      type: "landscape/clone",
      title: "Repository clone failed",
      detail: "auth failed",
      repoKey: "org/repo",
    })
    const result = new RepoAnalysisFailed({ repoKey: "org/repo", name: "repo", error })
    expect(result._tag).toBe("RepoAnalysisFailed")
    expect(result.error._tag).toBe("CloneError")
    expect(result.error.detail).toBe("auth failed")
  })

  test("outcome union is exhaustively switchable", () => {
    const outcomes = [
      new RepoAnalysisSkipped({ repoKey: "org/a", name: "a" }),
      new RepoAnalysisDone({ repoKey: "org/b", name: "b" }),
      new RepoAnalysisFailed({
        repoKey: "org/c",
        name: "c",
        error: new UnknownWorkerError({
          type: "landscape/unknown",
          title: "Unexpected worker error",
          detail: "boom",
          repoKey: "org/c",
        }),
      }),
    ]

    const tags = outcomes.map((o) => o._tag)
    expect(tags).toEqual(["RepoAnalysisSkipped", "RepoAnalysisDone", "RepoAnalysisFailed"])
  })
})
