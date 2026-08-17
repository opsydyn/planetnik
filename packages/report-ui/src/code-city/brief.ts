import type { CodeCityDependencyEdge, CodeCityDistrict, CodeCityEvidenceRef, CodeCityModel } from "@planetnik/common"
import type { CodeCityAudiencePresentation } from "./audience.js"
import { resolveCodeCityEvidenceHref } from "./evidence.js"
import type { CodeCityStory } from "./story.js"

export type CodeCityBriefEvidence = {
  readonly label: string
  readonly href: string
}

export type CodeCityBriefFact = {
  readonly label: string
  readonly value: string
  readonly evidence: readonly CodeCityBriefEvidence[]
}

export type CodeCityArchitectureBrief = {
  readonly title: string
  readonly lead: string
  readonly facts: readonly CodeCityBriefFact[]
  readonly nextAction: string
}

const compareText = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0

const evidenceLabel = (reference: CodeCityEvidenceRef): string =>
  `${reference.kind.charAt(0).toUpperCase()}${reference.kind.slice(1)}: ${reference.id}`

const largestContext = (model: CodeCityModel): CodeCityDistrict | null =>
  [...model.districts]
    .filter((district) => Number.isFinite(district.metrics.footprint.loc))
    .sort(
      (left, right) =>
        right.metrics.footprint.loc - left.metrics.footprint.loc || compareText(left.id, right.id),
    )[0] ?? null

const strongestBoundary = (model: CodeCityModel): CodeCityDependencyEdge | null => {
  const districtIds = new Set(model.districts.map((district) => district.id))
  return [...model.edges]
    .filter(
      (edge) =>
        edge.resolution === "both" &&
        Number.isFinite(edge.count) &&
        edge.count > 0 &&
        edge.sourceDistrictId !== null &&
        edge.targetDistrictId !== null &&
        districtIds.has(edge.sourceDistrictId) &&
        districtIds.has(edge.targetDistrictId),
    )
    .sort((left, right) => right.count - left.count || compareText(left.id, right.id))[0] ?? null
}

const normaliseBasePath = (basePath: string): string => {
  const href = resolveCodeCityEvidenceHref(basePath, "")
  return href === null || href === "/" ? "" : href.replace(/\/$/, "")
}

const evidenceFor = (references: readonly CodeCityEvidenceRef[], basePath: string): readonly CodeCityBriefEvidence[] => {
  const unique = new Map<string, CodeCityBriefEvidence>()
  for (const reference of references) {
    const href = resolveCodeCityEvidenceHref(basePath, reference.route)
    if (href !== null) unique.set(`${evidenceLabel(reference)}:${href}`, { label: evidenceLabel(reference), href })
  }
  return [...unique.values()].sort(
    (left, right) => compareText(left.href, right.href) || compareText(left.label, right.label),
  )
}

const canonicalStoryEvidence = (
  story: CodeCityStory,
  basePath: string,
): readonly CodeCityBriefEvidence[] => {
  const normalisedBasePath = normaliseBasePath(basePath)
  const evidence = new Map<string, CodeCityBriefEvidence>()
  for (const step of story.steps) {
    for (const item of step.evidence) {
      if (!item.href.startsWith("/")) continue
      const route = normalisedBasePath && item.href.startsWith(normalisedBasePath)
        ? item.href.slice(normalisedBasePath.length)
        : item.href
      const href = resolveCodeCityEvidenceHref(basePath, route)
      if (href === item.href) evidence.set(`${item.label}:${href}`, { label: item.label, href })
    }
  }
  return [...evidence.values()].sort(
    (left, right) => compareText(left.href, right.href) || compareText(left.label, right.label),
  )
}

const titleFor = (presentation: CodeCityAudiencePresentation): string =>
  `${presentation.label} architecture brief`

const leadFor = (presentation: CodeCityAudiencePresentation): string => {
  switch (presentation.audience) {
    case "architecture-review":
      return "A concise record of the largest context, strongest measured boundary, and canonical evidence."
    case "stakeholder":
      return "A concise record of the structure and evidence that supports the next conversation."
    default:
      return "A concise orientation to the largest context, a measured connection, and its canonical evidence."
  }
}

const nextActionFor = (presentation: CodeCityAudiencePresentation): string => {
  switch (presentation.audience) {
    case "architecture-review":
      return "Inspect the measured boundary and follow its canonical evidence."
    case "stakeholder":
      return "Use the evidence links to decide what warrants closer attention."
    default:
      return "Select the largest context, then use the evidence links to continue exploring."
  }
}

export function buildCodeCityArchitectureBrief(
  model: CodeCityModel,
  presentation: CodeCityAudiencePresentation,
  story: CodeCityStory,
  basePath: string,
): CodeCityArchitectureBrief {
  const largest = largestContext(model)
  const boundary = strongestBoundary(model)
  const largestEvidence = largest ? evidenceFor(largest.evidence, basePath) : []
  const boundaryEvidence = boundary ? evidenceFor(boundary.evidence, basePath) : []
  const storyEvidence = canonicalStoryEvidence(story, basePath)
  const evidence = storyEvidence.length > 0 ? storyEvidence : [...largestEvidence, ...boundaryEvidence]

  return {
    title: titleFor(presentation),
    lead: leadFor(presentation),
    facts: [
      {
        label: "Largest context",
        value: largest
          ? `${largest.label} (${largest.metrics.footprint.loc} LOC)`
          : "Unavailable",
        evidence: [],
      },
      {
        label: "Strongest boundary",
        value: boundary
          ? `${boundary.id} (${boundary.count} resolved relationship${boundary.count === 1 ? "" : "s"})`
          : "Unavailable",
        evidence: [],
      },
      {
        label: "Evidence",
        value: evidence.length > 0 ? `${evidence.length} canonical evidence link${evidence.length === 1 ? "" : "s"}` : "Unavailable",
        evidence,
      },
    ],
    nextAction: nextActionFor(presentation),
  }
}
