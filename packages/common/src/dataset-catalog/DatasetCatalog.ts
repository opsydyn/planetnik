import { Schema } from "@effect/schema"

const safeDatasetIdPattern = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/u
const uuidV4Pattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu

const DatasetModeSchema = Schema.Literal("single_repository", "landscape")
const DatasetAvailabilitySchema = Schema.Literal("ready", "partial", "planned", "invalid")

export type DatasetMode = typeof DatasetModeSchema.Type
export type DatasetAvailability = typeof DatasetAvailabilitySchema.Type

const DatasetSnapshotSchema = Schema.Struct({
  snapshotId: Schema.String,
  dataVersion: Schema.Literal(2),
  generatedAt: Schema.String,
})

const DatasetProvenanceSchema = Schema.Struct({
  sourceUrl: Schema.optional(Schema.String),
  sourceRef: Schema.optional(Schema.String),
  license: Schema.optional(Schema.String),
  capturedAt: Schema.optional(Schema.String),
})

const DatasetStatsSchema = Schema.Struct({
  repositories: Schema.optional(Schema.Number),
  files: Schema.optional(Schema.Number),
  loc: Schema.optional(Schema.Number),
  units: Schema.optional(Schema.Number),
  contributors: Schema.optional(Schema.Number),
  commits: Schema.optional(Schema.Number),
  dependencies: Schema.optional(Schema.Number),
})

const DatasetLanguageSchema = Schema.Struct({
  key: Schema.String,
  label: Schema.String,
  loc: Schema.Number,
  share: Schema.Number,
})

const DatasetCurationSchema = Schema.Struct({
  featured: Schema.Boolean,
  shelf: Schema.String,
  order: Schema.Number,
})

export const DatasetDescriptorSchema = Schema.Struct({
  id: Schema.String,
  slug: Schema.String,
  title: Schema.String,
  mode: DatasetModeSchema,
  snapshot: Schema.optional(DatasetSnapshotSchema),
  provenance: DatasetProvenanceSchema,
  description: Schema.String,
  stats: DatasetStatsSchema,
  languages: Schema.Array(DatasetLanguageSchema),
  capabilities: Schema.Array(Schema.String),
  tags: Schema.Array(Schema.String),
  curation: DatasetCurationSchema,
  availability: DatasetAvailabilitySchema,
})

export type DatasetDescriptor = typeof DatasetDescriptorSchema.Type

export const DatasetCatalogSchema = Schema.Struct({
  catalogVersion: Schema.Literal(1),
  datasets: Schema.Array(DatasetDescriptorSchema),
})

export type DatasetCatalog = typeof DatasetCatalogSchema.Type

function invalidDescriptor(message: string): never {
  throw new Error(`Invalid dataset descriptor: ${message}`)
}

function assertFiniteNonNegative(value: number, field: string): void {
  if (!Number.isFinite(value) || value < 0) {
    invalidDescriptor(`${field} must be a finite non-negative number`)
  }
}

function assertValidDescriptor(descriptor: DatasetDescriptor): DatasetDescriptor {
  if (!safeDatasetIdPattern.test(descriptor.id)) {
    invalidDescriptor("id must contain only lowercase letters, numbers, and hyphens")
  }
  if (!safeDatasetIdPattern.test(descriptor.slug)) {
    invalidDescriptor("slug must contain only lowercase letters, numbers, and hyphens")
  }
  if (!descriptor.title.trim()) invalidDescriptor("title must not be empty")
  if (!descriptor.description.trim()) {
    invalidDescriptor("description must not be empty")
  }
  if (!descriptor.curation.shelf.trim()) {
    invalidDescriptor("curation shelf must not be empty")
  }
  if (!Number.isInteger(descriptor.curation.order) || descriptor.curation.order < 0) {
    invalidDescriptor("curation order must be a non-negative integer")
  }

  if (descriptor.availability !== "planned" && descriptor.snapshot === undefined) {
    invalidDescriptor("ready, partial, and invalid entries require a snapshot")
  }
  if (descriptor.snapshot) {
    if (!uuidV4Pattern.test(descriptor.snapshot.snapshotId)) {
      invalidDescriptor("snapshot.snapshotId must be a UUID v4")
    }
    const generatedAt = new Date(descriptor.snapshot.generatedAt)
    if (Number.isNaN(generatedAt.valueOf()) || generatedAt.toISOString() !== descriptor.snapshot.generatedAt) {
      invalidDescriptor("snapshot.generatedAt must be an exact ISO timestamp")
    }
  }

  for (const [field, value] of Object.entries(descriptor.stats)) {
    if (value !== undefined) assertFiniteNonNegative(value, `stats.${field}`)
  }
  for (const language of descriptor.languages) {
    if (!language.key.trim() || !language.label.trim()) {
      invalidDescriptor("language key and label must not be empty")
    }
    assertFiniteNonNegative(language.loc, `languages.${language.key}.loc`)
    if (!Number.isFinite(language.share) || language.share < 0 || language.share > 100) {
      invalidDescriptor(`languages.${language.key}.share must be between 0 and 100`)
    }
  }

  return descriptor
}

export function decodeDatasetDescriptor(input: unknown): DatasetDescriptor {
  return assertValidDescriptor(Schema.decodeUnknownSync(DatasetDescriptorSchema)(input))
}

export function decodeDatasetCatalog(input: unknown): DatasetCatalog {
  const decoded = Schema.decodeUnknownSync(DatasetCatalogSchema)(input)
  const datasets = decoded.datasets.map(assertValidDescriptor)
  const ids = new Set<string>()
  const slugs = new Set<string>()

  for (const dataset of datasets) {
    if (ids.has(dataset.id)) {
      throw new Error(`Invalid dataset catalogue: duplicate id '${dataset.id}'`)
    }
    if (slugs.has(dataset.slug)) {
      throw new Error(`Invalid dataset catalogue: duplicate slug '${dataset.slug}'`)
    }
    ids.add(dataset.id)
    slugs.add(dataset.slug)
  }

  return {
    ...decoded,
    datasets: [...datasets].sort(
      (left, right) => left.curation.order - right.curation.order || left.id.localeCompare(right.id),
    ),
  }
}
