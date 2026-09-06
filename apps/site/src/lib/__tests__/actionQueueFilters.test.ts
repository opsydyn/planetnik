import { describe, expect, test } from "bun:test"
import type { PortfolioActionQueueFilters } from "@planetnik/common"
import {
  parsePortfolioActionFilters,
  portfolioActionFilterDefaults,
  serializePortfolioActionFilters,
} from "../datasets/actionQueueFilters.js"

describe("portfolio action queue URL filters", () => {
  test("parses repeated values into canonical deduplicated allowlisted filters", () => {
    const params = new URLSearchParams()
    for (const repositoryId of ["zeta", "repo:Requests Python Tree-sitter Pilot", "zeta", "", "  "])
      params.append("repo", repositoryId)
    for (const teamId of ["platform", "alpha team", "platform", ""]) params.append("team", teamId)
    for (const priority of ["low", "critical", "unknown", "high", "low", "", "unrated", "medium"])
      params.append("priority", priority)
    for (const domain of ["trend", "hotspot", "unknown", "control", "coupling", "trend", ""])
      params.append("domain", domain)
    params.set("window", "latest-compatible")

    expect(parsePortfolioActionFilters(params)).toEqual({
      repositoryIds: ["repo:Requests Python Tree-sitter Pilot", "zeta"],
      teamIds: ["alpha team", "platform"],
      priorityBands: ["critical", "high", "medium", "low", "unrated"],
      domains: ["control", "coupling", "hotspot", "trend"],
      window: "latest-compatible",
    })
  })

  test("ignores unknown scalar values and returns immutable current defaults", () => {
    const expected: PortfolioActionQueueFilters = {
      repositoryIds: [],
      teamIds: [],
      priorityBands: [],
      domains: [],
      window: "current",
    }
    const defaults = portfolioActionFilterDefaults()
    expect(defaults).toEqual(expected)
    expect(parsePortfolioActionFilters(new URLSearchParams("priority=urgent&domain=score&window=forever"))).toEqual(
      expected,
    )
    expect(Object.isFrozen(defaults)).toBe(true)
    expect(Object.isFrozen(defaults.repositoryIds)).toBe(true)
    expect(Object.isFrozen(defaults.teamIds)).toBe(true)
    expect(Object.isFrozen(defaults.priorityBands)).toBe(true)
    expect(Object.isFrozen(defaults.domains)).toBe(true)
  })

  test("serializes canonical encoded parameters while omitting current defaults", () => {
    const params = serializePortfolioActionFilters({
      repositoryIds: ["zeta", "repo:Requests Python Tree-sitter Pilot", "zeta"],
      teamIds: ["platform team", "alpha", "platform team"],
      priorityBands: ["low", "critical", "high", "low"],
      domains: ["trend", "control", "hotspot", "coupling", "control"],
      window: "current",
    })

    expect(params.toString()).toBe(
      "repo=repo%3ARequests+Python+Tree-sitter+Pilot&repo=zeta&team=alpha&team=platform+team&priority=critical&priority=high&priority=low&domain=control&domain=coupling&domain=hotspot&domain=trend",
    )
    expect(serializePortfolioActionFilters(portfolioActionFilterDefaults()).toString()).toBe("")
  })

  test("is stable across parse and serialize round trips", () => {
    const original = new URLSearchParams(
      "domain=trend&repo=zeta&priority=low&team=platform&repo=repo%3ARequests%20Python%20Tree-sitter%20Pilot&priority=critical&domain=control&window=30d&repo=zeta",
    )
    const parsed = parsePortfolioActionFilters(original)
    const serialized = serializePortfolioActionFilters(parsed)
    const reparsed = parsePortfolioActionFilters(serialized)
    const reserialized = serializePortfolioActionFilters(reparsed)

    expect(reparsed).toEqual(parsed)
    expect(reserialized.toString()).toBe(serialized.toString())
    expect(parsed.window).toBe("30d")
  })
})
