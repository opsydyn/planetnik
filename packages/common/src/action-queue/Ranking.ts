import type {
  PortfolioActionFreshness,
  PortfolioActionPriorityBand,
  PortfolioActionQueueItem,
  PortfolioActionTrend,
} from "./PortfolioActionQueue.js"

const priorityRanks: Readonly<Record<PortfolioActionPriorityBand, number>> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  unrated: 0,
}

const trendRanks: Readonly<Record<PortfolioActionTrend, number>> = {
  worsening: 3,
  stable: 2,
  improving: 1,
  unknown: 0,
}

const freshnessRanks: Readonly<Record<PortfolioActionFreshness, number>> = {
  fresh: 4,
  recent: 3,
  aging: 2,
  stale: 1,
  unknown: 0,
}

const comparePriority = (left: PortfolioActionPriorityBand, right: PortfolioActionPriorityBand): number =>
  priorityRanks[left] - priorityRanks[right]

const compareTrend = (left: PortfolioActionTrend, right: PortfolioActionTrend): number =>
  trendRanks[left] - trendRanks[right]

const compareFreshness = (left: PortfolioActionFreshness, right: PortfolioActionFreshness): number =>
  freshnessRanks[left] - freshnessRanks[right]

export const compareQueueItems = (left: PortfolioActionQueueItem, right: PortfolioActionQueueItem): number =>
  comparePriority(right.priorityBand, left.priorityBand) ||
  right.corroboration - left.corroboration ||
  compareTrend(right.trend, left.trend) ||
  compareFreshness(right.freshness, left.freshness) ||
  left.id.localeCompare(right.id)
