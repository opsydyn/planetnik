import { describe, expect, test } from "bun:test"
import { FastCheck } from "effect"
import type { DependabotAlert } from "../github/DependabotClient.js"
import { buildRepositoryHealth, computeSupplyChainExposure } from "../github/DependabotAnalyzer.js"

const SEVERITIES = ["critical", "high", "medium", "low"] as const
const STATES = ["open", "fixed", "dismissed", "auto_dismissed"] as const

const alertArb: FastCheck.Arbitrary<DependabotAlert> = FastCheck.record({
  number: FastCheck.integer({ min: 1, max: 10000 }),
  state: FastCheck.constantFrom(...STATES),
  dependency: FastCheck.constant({
    package: { ecosystem: "npm", name: "pkg" },
    manifest_path: "package.json",
    scope: "runtime",
  }),
  security_advisory: FastCheck.record({
    ghsa_id: FastCheck.string({ minLength: 1, maxLength: 20 }),
    cve_id: FastCheck.constant(null),
    summary: FastCheck.constant(""),
    severity: FastCheck.constantFrom(...SEVERITIES),
    published_at: FastCheck.constant("2024-01-01"),
  }),
  security_vulnerability: FastCheck.record({
    severity: FastCheck.constantFrom(...SEVERITIES),
    vulnerable_version_range: FastCheck.constant("< 1.0.0"),
    first_patched_version: FastCheck.constant(null),
  }),
  created_at: FastCheck.constant("2024-01-01T00:00:00Z"),
  updated_at: FastCheck.constant("2024-01-02T00:00:00Z"),
  fixed_at: FastCheck.constantFrom(null, "2024-02-01T00:00:00Z"),
  auto_dismissed_at: FastCheck.constant(null),
})

describe("DependabotAnalyzer — properties", () => {
  test("severity counts always sum to totalAlerts", () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.array(alertArb, { maxLength: 20 }), (alerts) => {
        const health = buildRepositoryHealth("owner", "repo", alerts)
        const sum =
          health.severityCounts.critical +
          health.severityCounts.high +
          health.severityCounts.medium +
          health.severityCounts.low
        expect(sum).toBe(health.totalAlerts)
      }),
      { numRuns: 50 },
    )
  })

  test("openAlerts + fixedAlerts <= totalAlerts", () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.array(alertArb, { maxLength: 20 }), (alerts) => {
        const health = buildRepositoryHealth("owner", "repo", alerts)
        expect(health.openAlerts + health.fixedAlerts).toBeLessThanOrEqual(health.totalAlerts)
      }),
      { numRuns: 50 },
    )
  })

  test("MTTR is null or non-negative", () => {
    FastCheck.assert(
      FastCheck.property(FastCheck.array(alertArb, { maxLength: 20 }), (alerts) => {
        const health = buildRepositoryHealth("owner", "repo", alerts)
        if (health.meanTimeToResolveDays !== null) {
          expect(health.meanTimeToResolveDays).toBeGreaterThanOrEqual(0)
        }
      }),
      { numRuns: 50 },
    )
  })

  test("supply chain exposure score is always in [0, 1]", () => {
    FastCheck.assert(
      FastCheck.property(
        FastCheck.integer({ min: 0, max: 100 }),
        FastCheck.integer({ min: 0, max: 100 }),
        FastCheck.integer({ min: 0, max: 50 }),
        (reposWithAlerts, totalRepos, sharedPkgs) => {
          const cappedReposWithAlerts = Math.min(reposWithAlerts, totalRepos)
          const score = computeSupplyChainExposure(cappedReposWithAlerts, totalRepos, sharedPkgs)
          expect(score).toBeGreaterThanOrEqual(0)
          expect(score).toBeLessThanOrEqual(1)
        },
      ),
      { numRuns: 100 },
    )
  })
})
