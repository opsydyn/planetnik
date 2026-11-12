import type { PortfolioActionQueueFilters, PortfolioActionWindow } from "@planetnik/common"
import type { ActionQueueArtifactParams } from "./actionQueueArtifactRoutes.js"
import { serializePortfolioActionFilters } from "./actionQueueFilters.js"

export type ActionQueuePageBounds = ActionQueueArtifactParams & {
  readonly pageCount: number
}

export function actionQueuePagePath(params: ActionQueueArtifactParams): string {
  return `/datasets/actions/${params.window}/${params.page}`
}

export function actionQueuePageFilters(
  filters: PortfolioActionQueueFilters,
  window: PortfolioActionWindow,
): PortfolioActionQueueFilters {
  return { ...filters, window }
}

export function actionQueuePageHref(params: ActionQueueArtifactParams, filters: PortfolioActionQueueFilters): string {
  const query = serializePortfolioActionFilters(filters)
  // Window and page are encoded in the path. Keeping filters query-only makes
  // pagination links canonical and avoids two sources of truth for the route.
  query.delete("window")
  const suffix = query.toString()
  return `${actionQueuePagePath(params)}${suffix ? `?${suffix}` : ""}`
}

export function actionQueuePageWindowLinks(
  bounds: ActionQueuePageBounds,
  filters: PortfolioActionQueueFilters,
): { readonly previous?: string; readonly next?: string } {
  const previous =
    bounds.page > 1 ? actionQueuePageHref({ window: bounds.window, page: bounds.page - 1 }, filters) : undefined
  const next =
    bounds.page < bounds.pageCount
      ? actionQueuePageHref({ window: bounds.window, page: bounds.page + 1 }, filters)
      : undefined
  return {
    ...(previous ? { previous } : {}),
    ...(next ? { next } : {}),
  }
}

export function actionQueueWindowLabel(window: PortfolioActionWindow): string {
  return (
    {
      current: "Current snapshot",
      "latest-compatible": "Latest compatible pair",
      "7d": "Last 7 days",
      "30d": "Last 30 days",
      "90d": "Last 90 days",
    } satisfies Record<PortfolioActionWindow, string>
  )[window]
}
