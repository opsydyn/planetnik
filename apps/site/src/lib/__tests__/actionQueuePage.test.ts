import { describe, expect, test } from "bun:test"
import {
  actionQueuePageFilters,
  actionQueuePageHref,
  actionQueuePagePath,
  actionQueuePageWindowLinks,
} from "../datasets/actionQueuePage.js"

describe("action queue page links", () => {
  test("builds deterministic page paths", () => {
    expect(actionQueuePagePath({ window: "current", page: 1 })).toBe("/datasets/actions/current/1")
    expect(actionQueuePagePath({ window: "90d", page: 3 })).toBe("/datasets/actions/90d/3")
  })

  test("preserves filters while pagination owns window and page", () => {
    const href = actionQueuePageHref(
      { window: "30d", page: 2 },
      {
        repositoryIds: ["repo:b"],
        teamIds: ["team:platform"],
        priorityBands: ["high"],
        domains: ["hotspot"],
        window: "30d",
      },
    )
    expect(href).toBe("/datasets/actions/30d/2?repo=repo%3Ab&team=team%3Aplatform&priority=high&domain=hotspot")
  })

  test("returns only existing neighbouring pages", () => {
    expect(
      actionQueuePageWindowLinks(
        { window: "current", page: 2, pageCount: 3 },
        { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" },
      ),
    ).toEqual({
      previous: "/datasets/actions/current/1",
      next: "/datasets/actions/current/3",
    })
    expect(
      actionQueuePageWindowLinks(
        { window: "current", page: 1, pageCount: 1 },
        { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" },
      ),
    ).toEqual({})
  })

  test("makes the route window authoritative over a stale query window", () => {
    expect(
      actionQueuePageFilters(
        { repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "90d" },
        "current",
      ),
    ).toEqual({ repositoryIds: [], teamIds: [], priorityBands: [], domains: [], window: "current" })
  })
})
