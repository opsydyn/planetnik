import type { CodeCityDependencyEdge, CodeCityDistrict, CodeCityEvidenceRef, CodeCityModel } from "@planetnik/common"
import { type CodeCityAudienceId, getCodeCityAudiencePresentation } from "./audience.js"
import { resolveCodeCityEvidenceHref } from "./evidence.js"
import type { CodeCitySelection } from "./selection.js"

export type CodeCityStoryStepId = "orient" | "name" | "connect" | "prove"

export type CodeCityStoryEvidence = {
  readonly label: string
  readonly href: string
}

export type CodeCityStoryStep = {
  readonly id: CodeCityStoryStepId
  readonly title: string
  readonly body: string
  readonly target: CodeCitySelection
  readonly relatedDistrictId: string | null
  readonly evidence: readonly CodeCityStoryEvidence[]
  readonly availability: "available" | "unavailable"
  readonly unavailableReason: string | null
}

export type CodeCityStory = {
  readonly audience: CodeCityAudienceId
  readonly steps: readonly CodeCityStoryStep[]
}

export type CodeCityStoryState =
  | { readonly tag: "idle" }
  | { readonly tag: "active"; readonly stepIndex: number; readonly focused: boolean }
  | { readonly tag: "completed" }

export type CodeCityStoryEvent =
  | { readonly type: "start" }
  | { readonly type: "next" }
  | { readonly type: "back" }
  | { readonly type: "skip" }
  | { readonly type: "exit" }
  | { readonly type: "focus" }
  | { readonly type: "complete" }

type ResolvedConnection = {
  readonly edge: CodeCityDependencyEdge
  readonly source: CodeCityDistrict
  readonly target: CodeCityDistrict
}

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0)

const plural = (count: number, noun: string): string => `${count} ${noun}${count === 1 ? "" : "s"}`

const evidenceLabel = (reference: CodeCityEvidenceRef): string =>
  `${reference.kind.charAt(0).toUpperCase()}${reference.kind.slice(1)}: ${reference.id}`

const evidenceKey = (reference: CodeCityEvidenceRef): string =>
  `${reference.kind}:${reference.id}:${reference.route ?? ""}`

const evidenceFor = (
  references: readonly CodeCityEvidenceRef[],
  basePath: string,
): readonly CodeCityStoryEvidence[] => {
  const unique = new Map<string, CodeCityEvidenceRef>()
  for (const reference of references) unique.set(evidenceKey(reference), reference)

  return [...unique.values()]
    .sort((left, right) => compareText(evidenceKey(left), evidenceKey(right)))
    .flatMap((reference) => {
      const href = resolveCodeCityEvidenceHref(basePath, reference.route)
      return href === null ? [] : [{ label: evidenceLabel(reference), href }]
    })
}

const unavailableStep = (
  id: CodeCityStoryStepId,
  title: string,
  body: string,
  reason: string,
  target: CodeCitySelection = null,
  relatedDistrictId: string | null = null,
): CodeCityStoryStep => ({
  id,
  title,
  body,
  target,
  relatedDistrictId,
  evidence: [],
  availability: "unavailable",
  unavailableReason: reason,
})

const availableStep = (
  id: CodeCityStoryStepId,
  title: string,
  body: string,
  target: CodeCitySelection,
  relatedDistrictId: string | null = null,
  evidence: readonly CodeCityStoryEvidence[] = [],
): CodeCityStoryStep => ({
  id,
  title,
  body,
  target,
  relatedDistrictId,
  evidence,
  availability: "available",
  unavailableReason: null,
})

const firstNamedDistrict = (model: CodeCityModel): CodeCityDistrict | null => {
  const id = model.layout.districtOrder[0]
  if (!id) return null
  return model.districts.find((district) => district.id === id) ?? null
}

const bestResolvedConnection = (model: CodeCityModel): ResolvedConnection | null => {
  const districtsById = new Map(model.districts.map((district) => [district.id, district]))
  const candidates = model.edges.flatMap((edge) => {
    if (
      edge.resolution !== "both" ||
      edge.count <= 0 ||
      !Number.isFinite(edge.count) ||
      edge.sourceDistrictId === null ||
      edge.targetDistrictId === null
    ) {
      return []
    }

    const source = districtsById.get(edge.sourceDistrictId)
    const target = districtsById.get(edge.targetDistrictId)
    return source && target ? [{ edge, source, target }] : []
  })

  return (
    candidates.sort(
      (left, right) => right.edge.count - left.edge.count || compareText(left.edge.id, right.edge.id),
    )[0] ?? null
  )
}

const nameStoryBody = (audience: CodeCityAudienceId, district: CodeCityDistrict): string => {
  const buildingCount = plural(district.buildingIds.length, "building")
  switch (audience) {
    case "architecture-review":
      return `${district.label} is a canonical district with ${buildingCount} in this snapshot.`
    case "stakeholder":
      return `${district.label} is one of the repository areas represented by ${buildingCount}.`
    default:
      return `This is the ${district.label} context. It contains ${buildingCount}.`
  }
}

const connectStoryBody = (audience: CodeCityAudienceId, connection: ResolvedConnection): string => {
  const relationshipCount = plural(connection.edge.count, "resolved relationship")
  switch (audience) {
    case "architecture-review":
      return `${connection.source.label} to ${connection.target.label} has ${relationshipCount}, the strongest resolved boundary in this snapshot.`
    case "stakeholder":
      return `${connection.source.label} and ${connection.target.label} have ${relationshipCount} represented in the city.`
    default:
      return `${connection.source.label} depends on ${connection.target.label} through ${relationshipCount}.`
  }
}

export function buildCodeCityStory(
  model: CodeCityModel,
  audience: CodeCityAudienceId,
  basePath: string,
): CodeCityStory {
  const presentation = getCodeCityAudiencePresentation(audience)
  const nameDistrict = firstNamedDistrict(model)
  const connection = bestResolvedConnection(model)
  const orient = availableStep(
    "orient",
    "Orient the city",
    `${presentation.orientation} This snapshot represents ${plural(model.coverage.counts.districts, "district")} and ${plural(model.coverage.counts.files, "building")}.`,
    null,
  )

  const name = nameDistrict
    ? availableStep(
        "name",
        "Name a district",
        nameStoryBody(audience, nameDistrict),
        { kind: "district", id: nameDistrict.id },
        null,
        evidenceFor(nameDistrict.evidence, basePath),
      )
    : unavailableStep(
        "name",
        "Name a district",
        "No canonical district is available to introduce in this snapshot.",
        "No district is present in the canonical layout.",
      )

  const connect = connection
    ? availableStep(
        "connect",
        "Connect the city",
        connectStoryBody(audience, connection),
        { kind: "district", id: connection.source.id },
        connection.target.id,
        evidenceFor(connection.edge.evidence, basePath),
      )
    : unavailableStep(
        "connect",
        "Connect the city",
        "No resolved district relationship is available to explain in this snapshot.",
        "No resolved district relationship is available in the canonical model.",
      )

  const proofTarget = connection
    ? { kind: "district" as const, id: connection.source.id }
    : nameDistrict
      ? { kind: "district" as const, id: nameDistrict.id }
      : null
  const proofRelatedDistrictId = connection?.target.id ?? null
  const proofEvidence = connection
    ? evidenceFor([...connection.edge.evidence, ...connection.source.evidence, ...connection.target.evidence], basePath)
    : nameDistrict
      ? evidenceFor(nameDistrict.evidence, basePath)
      : []
  const prove =
    proofTarget && proofEvidence.length > 0
      ? availableStep(
          "prove",
          "Prove the explanation",
          `Inspect ${connection ? `${connection.source.label} and its relationship to ${connection.target.label}` : nameDistrict!.label} and follow the canonical evidence links.`,
          proofTarget,
          proofRelatedDistrictId,
          proofEvidence,
        )
      : unavailableStep(
          "prove",
          "Prove the explanation",
          "No canonical evidence route is available for this explanation.",
          "No canonical evidence route is available for the selected story target.",
          proofTarget,
          proofRelatedDistrictId,
        )

  return { audience, steps: [orient, name, connect, prove] }
}

const normaliseStepCount = (stepCount: number): number =>
  Number.isFinite(stepCount) ? Math.max(0, Math.floor(stepCount)) : 0

const clampStepIndex = (stepIndex: number, stepCount: number): number =>
  Number.isFinite(stepIndex) ? Math.min(Math.max(0, Math.floor(stepIndex)), stepCount - 1) : 0

const nextState = (
  state: Extract<CodeCityStoryState, { readonly tag: "active" }>,
  stepCount: number,
): CodeCityStoryState => {
  const stepIndex = clampStepIndex(state.stepIndex, stepCount)
  return stepIndex === stepCount - 1
    ? { tag: "completed" }
    : { tag: "active", stepIndex: stepIndex + 1, focused: false }
}

export function reduceCodeCityStoryState(
  state: CodeCityStoryState,
  event: CodeCityStoryEvent,
  stepCount: number,
): CodeCityStoryState {
  const count = normaliseStepCount(stepCount)
  if (event.type === "exit") return { tag: "idle" }
  if (event.type === "complete") return { tag: "completed" }
  if (event.type === "start") {
    return count === 0 ? { tag: "completed" } : { tag: "active", stepIndex: 0, focused: false }
  }
  if (state.tag !== "active") return state
  if (count === 0) return { tag: "completed" }

  const stepIndex = clampStepIndex(state.stepIndex, count)
  switch (event.type) {
    case "next":
    case "skip":
      return nextState(state, count)
    case "back":
      return { tag: "active", stepIndex: Math.max(0, stepIndex - 1), focused: false }
    case "focus":
      return { tag: "active", stepIndex, focused: true }
  }
}
