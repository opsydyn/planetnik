import { describe, expect, test } from "bun:test"
import { LandscapeConfiguration } from "@planetnik/analyzer"
import { hydrateLandscapeConfiguration } from "../commands/landscapeConfigHydrator.js"

describe("hydrateLandscapeConfiguration", () => {
  test("hydrates teams, tags, and merge extensions with working class methods", () => {
    const hydrated = hydrateLandscapeConfiguration(new LandscapeConfiguration(), {
      metadata: {
        name: "OpenAI OSS Landscape",
        description: "Multi-repo analysis",
      },
      teamsConfig: {
        teams: [
          {
            name: "Platform",
            description: "Shared platform work",
            emailPatterns: [".*@platform\\.example\\.com"],
          },
        ],
      },
      tagGroups: [
        {
          name: "Domain",
          description: "Repository domain tags",
          color: "#8b5cf6",
          repositoryTags: [
            {
              tag: "SDK",
              patterns: [".*-sdk"],
              anyExtensions: ["ts"],
              imageLink: "/sdk.svg",
            },
          ],
        },
      ],
      mergeExtensions: [{ primary: "ts", secondary: "tsx" }],
    })

    expect(hydrated.metadata.name).toBe("OpenAI OSS Landscape")
    expect(hydrated.teamsConfig.getTeam("alice@platform.example.com")).toBe("Platform")
    expect(hydrated.tagGroups).toHaveLength(1)
    expect(hydrated.tagGroups[0]!.repositoryTags).toHaveLength(1)
    expect(hydrated.tagGroups[0]!.repositoryTags[0]!.group?.name).toBe("Domain")
    expect(hydrated.tagGroups[0]!.repositoryTags[0]!.matchesName("agent-sdk")).toBe(true)
    expect(hydrated.mergeExtensions[0]).toEqual({ primary: "ts", secondary: "tsx" })
  })
})
