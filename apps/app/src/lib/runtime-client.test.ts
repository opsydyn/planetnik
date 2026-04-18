import { describe, expect, mock, test } from "bun:test"

const repositoryGet = mock(async () => ({
  data: {
    repository: {
      repoKey: "alanpcurrie/next-app-playground",
      name: "next-app-playground",
      description: "next-app-playground",
      latestCommitDate: "2026-04-01",
      commits30d: 1,
      commits90d: 2,
      contributorsCount: 3,
      filesCount: 4,
      linesOfCode: 5,
      duplicationPercentage: null,
      links: [],
      contributors: [],
      topContributors: [],
    },
  },
}))

const repositoriesMock = mock((_params: { repo: string }) => ({
  get: repositoryGet,
}))

mock.module("@elysiajs/eden/treaty2", () => ({
  treaty: () => ({
    api: {
      reports: (_params: { slug: string }) => ({
        repositories: repositoriesMock,
      }),
    },
  }),
}))

const { getRuntimeReportLandscapeRepository } = await import("./runtime-client.js")

describe("runtime client landscape repository paths", () => {
  test("passes raw repo keys to the typed client without double encoding", async () => {
    const repository = await getRuntimeReportLandscapeRepository(
      "better-auth.session_token=abc",
      "alanpcurrie-landscape",
      "alanpcurrie/next-app-playground",
    )

    expect(repository?.repoKey).toBe("alanpcurrie/next-app-playground")
    expect(repositoriesMock).toHaveBeenCalledWith({
      repo: "alanpcurrie/next-app-playground",
    })
  })
})
