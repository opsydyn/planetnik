import { describe, expect, test } from "bun:test"
import { DateUtils } from "../filehistory/FileHistoryUtils.js"
import { FileModificationHistory } from "../filehistory/FileModificationHistory.js"
import { ContributorConnectionUtils } from "../landscape/ContributorConnectionUtils.js"
import { LandscapeConfiguration } from "../landscape/LandscapeConfiguration.js"
import { PeopleConfig } from "../landscape/PeopleConfig.js"
import { PersonConfig } from "../landscape/PersonConfig.js"
import { TeamConfig } from "../landscape/TeamConfig.js"
import { TeamsConfig } from "../landscape/TeamsConfig.js"

describe("TeamsConfig", () => {
  test("matches email to team by pattern", () => {
    const config = new TeamsConfig()
    const team1 = new TeamConfig()
    team1.name = "Frontend"
    team1.emailPatterns = [".*@frontend\\.com"]
    const team2 = new TeamConfig()
    team2.name = "Backend"
    team2.emailPatterns = [".*@backend\\.com"]
    config.teams = [team1, team2]

    expect(config.getTeam("alice@frontend.com")).toBe("Frontend")
    expect(config.getTeam("bob@backend.com")).toBe("Backend")
    expect(config.getTeam("charlie@other.com")).toBeNull()
  })
})

describe("PeopleConfig", () => {
  test("finds person by email pattern", () => {
    const config = new PeopleConfig()
    const person = new PersonConfig()
    person.name = "Alice"
    person.emailPatterns = ["alice@.*"]
    config.people = [person]

    const found = config.getPersonFromEmailPatterns("alice@company.com")
    expect(found.name).toBe("Alice")
  })

  test("returns fallback for unknown email", () => {
    const config = new PeopleConfig()
    const found = config.getPersonFromEmailPatterns("unknown@test.com")
    expect(found.name).toBe("unknown@test.com")
  })

  test("finds person by name", () => {
    const config = new PeopleConfig()
    const person = new PersonConfig()
    person.name = "Bob"
    config.people = [person]

    expect(config.getPersonByName("Bob").name).toBe("Bob")
  })

  test("caches lookups", () => {
    const config = new PeopleConfig()
    const person = new PersonConfig()
    person.name = "Alice"
    person.emailPatterns = ["alice@.*"]
    config.people = [person]

    const first = config.getPersonFromEmailPatterns("alice@test.com")
    const second = config.getPersonFromEmailPatterns("alice@test.com")
    expect(first).toBe(second)
  })
})

describe("LandscapeConfiguration", () => {
  test("has teams and people config", () => {
    const config = new LandscapeConfiguration()
    expect(config.teamsConfig.teams).toEqual([])
    expect(config.peopleConfig.people).toEqual([])
    expect(config.contributorTags).toEqual([])
    expect(config.tagGroups).toEqual([])
    expect(config.customTabs).toEqual([])
    expect(config.mergeExtensions).toEqual([])
  })
})

describe("ContributorConnectionUtils", () => {
  test("getPeopleDependencies finds contributors sharing files", () => {
    DateUtils.setDateParam("2024-06-01")

    const h1 = new FileModificationHistory("src/app.ts")
    h1.commits = [
      { date: "2024-05-20", email: "alice@test.com", id: "c1" },
      { date: "2024-05-21", email: "bob@test.com", id: "c2" },
    ]

    const h2 = new FileModificationHistory("src/lib.ts")
    h2.commits = [{ date: "2024-05-22", email: "alice@test.com", id: "c3" }]

    const deps = ContributorConnectionUtils.getPeopleDependencies([h1, h2], 30)
    expect(deps).toHaveLength(1)
    expect(deps[0]!.count).toBe(1) // shared 1 file (app.ts)
    DateUtils.reset()
  })

  test("getPeopleFileDependencies maps contributors to files", () => {
    DateUtils.setDateParam("2024-06-01")

    const h1 = new FileModificationHistory("src/app.ts")
    h1.commits = [
      { date: "2024-05-20", email: "alice@test.com", id: "c1" },
      { date: "2024-05-21", email: "alice@test.com", id: "c2" },
    ]

    const deps = ContributorConnectionUtils.getPeopleFileDependencies([h1], 30)
    expect(deps).toHaveLength(1)
    expect(deps[0]!.fromComponent).toBe("alice@test.com")
    expect(deps[0]!.toComponent).toBe("[src/app.ts]")
    expect(deps[0]!.count).toBe(2)
    DateUtils.reset()
  })

  test("getCIndex computes h-index-like metric", () => {
    const connections = [
      { email: "a", repositoriesCount: 0, connectionsCount: 5 },
      { email: "b", repositoriesCount: 0, connectionsCount: 3 },
      { email: "c", repositoriesCount: 0, connectionsCount: 2 },
      { email: "d", repositoriesCount: 0, connectionsCount: 1 },
    ]
    expect(ContributorConnectionUtils.getCIndex(connections)).toBe(2)
  })

  test("getCMedian computes median connections", () => {
    const connections = [
      { email: "a", repositoriesCount: 0, connectionsCount: 10 },
      { email: "b", repositoriesCount: 0, connectionsCount: 5 },
      { email: "c", repositoriesCount: 0, connectionsCount: 1 },
    ]
    expect(ContributorConnectionUtils.getCMedian(connections)).toBe(5)
  })

  test("getCMean computes average connections", () => {
    const connections = [
      { email: "a", repositoriesCount: 0, connectionsCount: 6 },
      { email: "b", repositoriesCount: 0, connectionsCount: 3 },
      { email: "c", repositoriesCount: 0, connectionsCount: 3 },
    ]
    expect(ContributorConnectionUtils.getCMean(connections)).toBe(4)
  })
})
