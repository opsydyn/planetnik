import { describe, expect, test } from "bun:test"
import {
  getContributorDisplayName,
  getContributorEmailFromParam,
  getContributorHref,
  getContributorMonthlyActivity,
  getContributorRouteParam,
} from "../contributors"

describe("contributors helpers", () => {
  test("getContributorDisplayName prefers user name", () => {
    expect(getContributorDisplayName({ email: "alice@example.com", userName: "Alice Example" })).toBe("Alice Example")
  })

  test("getContributorDisplayName falls back to email local part", () => {
    expect(getContributorDisplayName({ email: "alice@example.com" })).toBe("alice")
  })

  test("getContributorHref encodes email path segments", () => {
    expect(getContributorHref("alice+bot@example.com")).toBe("/contributors/alice$2Bbot$40example.com")
  })

  test("getContributorHref can carry a source query param", () => {
    expect(getContributorHref("alice+bot@example.com", { source: "topology" })).toBe(
      "/contributors/alice$2Bbot$40example.com?from=topology",
    )
  })

  test("getContributorRouteParam encodes email path segments", () => {
    expect(getContributorRouteParam("alice+bot@example.com")).toBe("alice$2Bbot$40example.com")
  })

  test("getContributorEmailFromParam decodes route parameters", () => {
    expect(getContributorEmailFromParam("alice$2Bbot$40example.com")).toBe("alice+bot@example.com")
  })

  test("getContributorMonthlyActivity rolls daily activity into sorted month buckets", () => {
    expect(
      getContributorMonthlyActivity([
        { date: "2025-02-01", commits: 1 },
        { date: "2025-01-12", commits: 2 },
        { date: "2025-02-14", commits: 3 },
        { date: "2025-01-25", commits: 4 },
      ]),
    ).toEqual([
      { label: "2025-01", value: 6 },
      { label: "2025-02", value: 4 },
    ])
  })
})
