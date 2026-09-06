import { describe, expect, test } from "bun:test"
import { Effect, Layer, Ref } from "effect"
import {
  buildRepoFailureReport,
  LandscapeRepoWorker,
  type LandscapeRunSummary,
  makeLandscapeRunSummary,
  type RepoAnalysisTask,
  runRepoAnalysis,
} from "../commands/analyzeLandscape.js"
import {
  CloneError,
  InvalidConcurrencyError,
  RepoAnalysisDone,
  RepoAnalysisFailed,
  RepoAnalysisSkipped,
} from "../domain/landscape.js"
import type { GitHubRepo } from "../github/GitHubRepoFinder.js"

function repo(name: string): GitHubRepo {
  return {
    name,
    description: null,
    html_url: `https://github.com/acme/${name}`,
    clone_url: `https://github.com/acme/${name}.git`,
    size: 0,
    archived: false,
    language: "TypeScript",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    pushed_at: "2026-01-01T00:00:00Z",
    watchers: 0,
  }
}

function task(name: string, skip = false): RepoAnalysisTask {
  return {
    org: "acme",
    repo: repo(name),
    repoOutputDir: `/tmp/planetnik-test/${name}`,
    cloneUrl: `https://github.com/acme/${name}.git`,
    skip,
  }
}

describe("runRepoAnalysis", () => {
  test("bounds active workers and preserves input order", async () => {
    let active = 0
    let maximumActive = 0
    const summaryRef = await Effect.runPromise(Ref.make<LandscapeRunSummary>(makeLandscapeRunSummary(5)))

    const workerLayer = Layer.succeed(LandscapeRepoWorker, {
      run: (request: RepoAnalysisTask) =>
        Effect.gen(function* () {
          active += 1
          maximumActive = Math.max(maximumActive, active)
          yield* Effect.sleep("10 millis")
          return new RepoAnalysisDone({ repoKey: `${request.org}/${request.repo.name}`, name: request.repo.name })
        }).pipe(Effect.ensuring(Effect.sync(() => (active -= 1)))),
    })

    const outcomes = await Effect.runPromise(
      runRepoAnalysis([task("one"), task("two"), task("three"), task("four"), task("five")], 2, summaryRef).pipe(
        Effect.provide(workerLayer),
      ),
    )

    expect(maximumActive).toBe(2)
    expect(outcomes.map((outcome) => outcome.name)).toEqual(["one", "two", "three", "four", "five"])
    expect(await Effect.runPromise(Ref.get(summaryRef))).toEqual({
      total: 5,
      completed: 5,
      analyzed: 5,
      skipped: 0,
      failed: 0,
    })
  })

  test("returns skipped outcomes without invoking the worker", async () => {
    const invoked: string[] = []
    const summaryRef = await Effect.runPromise(Ref.make<LandscapeRunSummary>(makeLandscapeRunSummary(2)))
    const workerLayer = Layer.succeed(LandscapeRepoWorker, {
      run: (request: RepoAnalysisTask) =>
        Effect.sync(() => {
          invoked.push(request.repo.name)
          return new RepoAnalysisDone({ repoKey: `${request.org}/${request.repo.name}`, name: request.repo.name })
        }),
    })

    const outcomes = await Effect.runPromise(
      runRepoAnalysis([task("already-there", true), task("fresh")], 2, summaryRef).pipe(Effect.provide(workerLayer)),
    )

    expect(invoked).toEqual(["fresh"])
    expect(outcomes[0]).toBeInstanceOf(RepoAnalysisSkipped)
    expect(outcomes[1]).toBeInstanceOf(RepoAnalysisDone)
    expect(await Effect.runPromise(Ref.get(summaryRef))).toEqual({
      total: 2,
      completed: 2,
      analyzed: 1,
      skipped: 1,
      failed: 0,
    })
  })

  test("records failed outcomes in the concurrent summary", async () => {
    const summaryRef = await Effect.runPromise(Ref.make<LandscapeRunSummary>(makeLandscapeRunSummary(2)))
    const workerLayer = Layer.succeed(LandscapeRepoWorker, {
      run: (request: RepoAnalysisTask) =>
        request.repo.name === "broken"
          ? Effect.succeed(
              new RepoAnalysisFailed({
                repoKey: `${request.org}/${request.repo.name}`,
                name: request.repo.name,
                error: new CloneError({
                  type: "landscape/clone",
                  title: "Repository clone failed",
                  detail: "fixture failure",
                  repoKey: `${request.org}/${request.repo.name}`,
                }),
              }),
            )
          : Effect.succeed(
              new RepoAnalysisDone({ repoKey: `${request.org}/${request.repo.name}`, name: request.repo.name }),
            ),
    })

    const outcomes = await Effect.runPromise(
      runRepoAnalysis([task("healthy"), task("broken")], 2, summaryRef).pipe(Effect.provide(workerLayer)),
    )

    expect(outcomes.map((outcome) => outcome._tag)).toEqual(["RepoAnalysisDone", "RepoAnalysisFailed"])
    expect(buildRepoFailureReport(outcomes)).toEqual([
      {
        repoKey: "acme/broken",
        errorType: "CloneError",
        detail: "fixture failure",
      },
    ])
    expect(await Effect.runPromise(Ref.get(summaryRef))).toEqual({
      total: 2,
      completed: 2,
      analyzed: 1,
      skipped: 0,
      failed: 1,
    })
  })

  test("rejects a non-positive concurrency limit before starting work", async () => {
    const summaryRef = await Effect.runPromise(Ref.make<LandscapeRunSummary>(makeLandscapeRunSummary(1)))
    const workerLayer = Layer.succeed(LandscapeRepoWorker, {
      run: () => Effect.die("worker must not start"),
    })

    const result = await Effect.runPromise(
      runRepoAnalysis([task("never")], 0, summaryRef).pipe(Effect.provide(workerLayer), Effect.either),
    )

    expect(result._tag).toBe("Left")
    if (result._tag === "Left") {
      expect(result.left).toBeInstanceOf(InvalidConcurrencyError)
    }
  })
})
