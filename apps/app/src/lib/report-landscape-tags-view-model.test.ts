import { describe, expect, test } from "bun:test"
import { buildReportLandscapeTagsViewModel } from "./report-landscape-tags-view-model.js"

describe("report landscape tags view model", () => {
  test("builds cards, bars, rows, and untagged repository copy", () => {
    const viewModel = buildReportLandscapeTagsViewModel({
      tags: {
        groupCount: 2,
        tagCount: 3,
        untaggedRepositoryCount: 1,
        tags: [
          {
            id: "team:team:web",
            group: "team",
            tag: "Web",
            repositoryCount: 2,
            totalMainLinesOfCode: 18450,
            repositories: ["web-app", "marketing-site"],
          },
          {
            id: "domain:domain:payments",
            group: "domain",
            tag: "Payments",
            repositoryCount: 1,
            totalMainLinesOfCode: 9200,
            repositories: ["api"],
          },
        ],
        untaggedRepositories: ["legacy-tool"],
      },
    })

    expect(viewModel.heading).toBe("Tags")
    expect(viewModel.cards).toEqual([
      { label: "Tag Groups", value: "2" },
      { label: "Tags", value: "3" },
      { label: "Untagged Repos", value: "1" },
    ])
    expect(viewModel.topTagBars).toEqual([
      { label: "Web", value: 2 },
      { label: "Payments", value: 1 },
    ])
    expect(viewModel.rows[0]).toEqual({
      id: "team:team:web",
      group: "team",
      tag: "Web",
      repositoryCount: 2,
      totalMainLinesOfCode: 18450,
      repositories: "web-app • marketing-site",
    })
    expect(viewModel.untaggedRepositories).toEqual(["legacy-tool"])
  })
})
