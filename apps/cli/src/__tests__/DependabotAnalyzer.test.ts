import { describe, expect, test } from "bun:test"
import {
  buildLandscapeHealth,
  buildRepositoryHealth,
  computeSupplyChainExposure,
  findSharedVulnerablePackages,
} from "../github/DependabotAnalyzer.js"
import type { DependabotAlert } from "../github/DependabotClient.js"

function makeAlert(overrides: Partial<DependabotAlert> = {}): DependabotAlert {
  return {
    number: 1,
    state: "open",
    dependency: {
      package: { ecosystem: "npm", name: "lodash" },
      manifest_path: "package.json",
      scope: "runtime",
    },
    security_advisory: {
      ghsa_id: "GHSA-xxxx",
      cve_id: "CVE-2021-1234",
      summary: "Test vulnerability",
      severity: "high",
      published_at: "2024-01-01T00:00:00Z",
    },
    security_vulnerability: {
      severity: "high",
      vulnerable_version_range: "< 1.0.0",
      first_patched_version: { identifier: "1.0.0" },
    },
    created_at: "2024-01-15T00:00:00Z",
    updated_at: "2024-01-16T00:00:00Z",
    fixed_at: null,
    auto_dismissed_at: null,
    ...overrides,
  }
}

describe("buildRepositoryHealth", () => {
  test("computes counts for a mix of open and fixed alerts", () => {
    const alerts = [
      makeAlert({
        number: 1,
        state: "open",
        security_advisory: {
          ...makeAlert().security_advisory,
          severity: "critical",
        },
        security_vulnerability: {
          ...makeAlert().security_vulnerability,
          severity: "critical",
        },
      }),
      makeAlert({
        number: 2,
        state: "open",
        security_advisory: {
          ...makeAlert().security_advisory,
          severity: "high",
        },
        security_vulnerability: {
          ...makeAlert().security_vulnerability,
          severity: "high",
        },
      }),
      makeAlert({
        number: 3,
        state: "fixed",
        fixed_at: "2024-02-01T00:00:00Z",
      }),
    ]

    const health = buildRepositoryHealth("alanpcurrie", "my-repo", alerts)

    expect(health.owner).toBe("alanpcurrie")
    expect(health.repo).toBe("my-repo")
    expect(health.totalAlerts).toBe(3)
    expect(health.openAlerts).toBe(2)
    expect(health.fixedAlerts).toBe(1)
    expect(health.severityCounts.critical).toBe(1)
    expect(health.severityCounts.high).toBe(2)
    expect(health.severityCounts.medium).toBe(0)
    expect(health.severityCounts.low).toBe(0)
  })

  test("returns zero counts for empty alerts", () => {
    const health = buildRepositoryHealth("owner", "repo", [])

    expect(health.totalAlerts).toBe(0)
    expect(health.openAlerts).toBe(0)
    expect(health.fixedAlerts).toBe(0)
    expect(health.meanTimeToResolveDays).toBeNull()
  })

  test("computes MTTR from fixed alerts", () => {
    const alerts = [
      makeAlert({
        number: 1,
        state: "fixed",
        created_at: "2024-01-01T00:00:00Z",
        fixed_at: "2024-01-11T00:00:00Z", // 10 days
      }),
      makeAlert({
        number: 2,
        state: "fixed",
        created_at: "2024-01-01T00:00:00Z",
        fixed_at: "2024-01-21T00:00:00Z", // 20 days
      }),
    ]

    const health = buildRepositoryHealth("owner", "repo", alerts)
    expect(health.meanTimeToResolveDays).toBe(15) // avg of 10 and 20
  })

  test("MTTR is null when no fixed alerts", () => {
    const alerts = [makeAlert({ state: "open" })]
    const health = buildRepositoryHealth("owner", "repo", alerts)
    expect(health.meanTimeToResolveDays).toBeNull()
  })
})

describe("findSharedVulnerablePackages", () => {
  test("identifies packages appearing in multiple repos", () => {
    const alertsByRepo = new Map<string, DependabotAlert[]>([
      [
        "repo-a",
        [
          makeAlert({
            dependency: {
              ...makeAlert().dependency,
              package: { ecosystem: "npm", name: "lodash" },
            },
          }),
        ],
      ],
      [
        "repo-b",
        [
          makeAlert({
            dependency: {
              ...makeAlert().dependency,
              package: { ecosystem: "npm", name: "lodash" },
            },
          }),
        ],
      ],
      [
        "repo-c",
        [
          makeAlert({
            dependency: {
              ...makeAlert().dependency,
              package: { ecosystem: "npm", name: "axios" },
            },
          }),
        ],
      ],
    ])

    const shared = findSharedVulnerablePackages(alertsByRepo)

    expect(shared).toHaveLength(1)
    expect(shared[0]!.name).toBe("lodash")
    expect(shared[0]!.affectedRepos).toContain("repo-a")
    expect(shared[0]!.affectedRepos).toContain("repo-b")
    expect(shared[0]!.affectedRepos).not.toContain("repo-c")
  })

  test("returns empty when no shared packages", () => {
    const alertsByRepo = new Map<string, DependabotAlert[]>([
      [
        "repo-a",
        [
          makeAlert({
            dependency: {
              ...makeAlert().dependency,
              package: { ecosystem: "npm", name: "a" },
            },
          }),
        ],
      ],
      [
        "repo-b",
        [
          makeAlert({
            dependency: {
              ...makeAlert().dependency,
              package: { ecosystem: "npm", name: "b" },
            },
          }),
        ],
      ],
    ])

    const shared = findSharedVulnerablePackages(alertsByRepo)
    expect(shared).toHaveLength(0)
  })
})

describe("computeSupplyChainExposure", () => {
  test("returns 0 when no repos have alerts", () => {
    expect(computeSupplyChainExposure(0, 10, 0)).toBe(0)
  })

  test("returns 0 when there are no repos", () => {
    expect(computeSupplyChainExposure(0, 0, 0)).toBe(0)
  })

  test("returns 1 when all repos have alerts and shared packages exist", () => {
    const score = computeSupplyChainExposure(5, 5, 3)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(1)
  })

  test("score increases with more shared packages", () => {
    const low = computeSupplyChainExposure(3, 10, 0)
    const high = computeSupplyChainExposure(3, 10, 5)
    expect(high).toBeGreaterThan(low)
  })

  test("score is always between 0 and 1", () => {
    expect(computeSupplyChainExposure(100, 100, 100)).toBeLessThanOrEqual(1)
    expect(computeSupplyChainExposure(100, 100, 100)).toBeGreaterThanOrEqual(0)
  })
})

describe("buildLandscapeHealth", () => {
  test("aggregates across multiple repos", () => {
    const alertsByRepo = new Map<string, DependabotAlert[]>([
      [
        "repo-a",
        [
          makeAlert({
            number: 1,
            state: "open",
            security_advisory: {
              ...makeAlert().security_advisory,
              severity: "critical",
            },
            security_vulnerability: {
              ...makeAlert().security_vulnerability,
              severity: "critical",
            },
          }),
        ],
      ],
      [
        "repo-b",
        [
          makeAlert({
            number: 1,
            state: "fixed",
            fixed_at: "2024-02-01T00:00:00Z",
          }),
        ],
      ],
      ["repo-c", []],
    ])

    const health = buildLandscapeHealth(alertsByRepo)

    expect(health.totalRepos).toBe(3)
    expect(health.reposWithAlerts).toBe(2)
    expect(health.totalAlerts).toBe(2)
    expect(health.totalOpenAlerts).toBe(1)
    expect(health.severityCounts.critical).toBe(1)
    expect(health.severityCounts.high).toBe(1)
    expect(health.repoHealth).toHaveLength(3)
    expect(health.supplyChainExposureScore).toBeGreaterThanOrEqual(0)
    expect(health.supplyChainExposureScore).toBeLessThanOrEqual(1)
  })

  test("includes enrichment summary and ranks actionable vulnerabilities", () => {
    const alertsByRepo = new Map<string, DependabotAlert[]>([
      [
        "repo-a",
        [
          makeAlert({
            number: 1,
            state: "open",
            security_advisory: {
              ...makeAlert().security_advisory,
              cve_id: "CVE-2024-0001",
              ghsa_id: "GHSA-priority-a",
              severity: "critical",
              published_at: "2024-03-01T00:00:00Z",
            },
            security_vulnerability: {
              ...makeAlert().security_vulnerability,
              severity: "critical",
              first_patched_version: { identifier: "9.9.9" },
            },
            created_at: "2024-03-10T00:00:00Z",
          }),
        ],
      ],
      [
        "repo-b",
        [
          makeAlert({
            number: 2,
            state: "open",
            security_advisory: {
              ...makeAlert().security_advisory,
              cve_id: "CVE-2024-0001",
              ghsa_id: "GHSA-priority-b",
              severity: "critical",
              published_at: "2024-03-01T00:00:00Z",
            },
            security_vulnerability: {
              ...makeAlert().security_vulnerability,
              severity: "critical",
              first_patched_version: { identifier: "9.9.9" },
            },
            created_at: "2024-03-05T00:00:00Z",
          }),
        ],
      ],
    ])

    const health = buildLandscapeHealth(alertsByRepo, {
      enrichedAt: "2024-04-01T12:00:00Z",
      epssAvailable: true,
      kevAvailable: true,
      epssByCve: new Map([
        [
          "CVE-2024-0001",
          {
            cveId: "CVE-2024-0001",
            score: 0.91,
            percentile: 0.99,
            date: "2024-04-01",
          },
        ],
      ]),
      knownExploitedCves: new Set(["CVE-2024-0001"]),
    })

    expect(health.enrichmentSummary.enrichedAt).toBe("2024-04-01T12:00:00Z")
    expect(health.enrichmentSummary.uniqueCveCount).toBe(1)
    expect(health.enrichmentSummary.epssCoverageCount).toBe(1)
    expect(health.enrichmentSummary.knownExploitedCount).toBe(1)
    expect(health.topActionableVulnerabilities).toHaveLength(2)
    expect(health.topActionableVulnerabilities[0]).toMatchObject({
      advisoryId: "CVE-2024-0001",
      knownExploited: true,
      recommendedAction: "Patch immediately to 9.9.9",
    })
    expect(health.topActionableVulnerabilities[0]!.epssPercentile).toBe(0.99)
    expect(health.topActionableVulnerabilities[0]!.sharedRepoCount).toBe(2)
  })
})
