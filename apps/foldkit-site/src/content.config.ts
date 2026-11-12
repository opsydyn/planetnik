import { defineCollection } from "astro:content"
import { reportCollectionDefinitions as definitions } from "@planetnik/report-data/lib/collections"

// Loaders and schemas live in @planetnik/report-data so apps/site and
// apps/foldkit-site cannot drift. Astro requires this file in the app, and
// `defineCollection` is only available from the virtual astro:content module,
// so the wiring stays here and is written out per collection to keep Astro's
// content-type generation statically analysable.
export const collections = {
  reportContext: defineCollection(definitions.reportContext),
  analysis: defineCollection(definitions.analysis),
  filesMain: defineCollection(definitions.filesMain),
  filesTest: defineCollection(definitions.filesTest),
  units: defineCollection(definitions.units),
  duplicates: defineCollection(definitions.duplicates),
  dependencies: defineCollection(definitions.dependencies),
  metrics: defineCollection(definitions.metrics),
  controls: defineCollection(definitions.controls),
  findings: defineCollection(definitions.findings),
  hotspots: defineCollection(definitions.hotspots),
  impact: defineCollection(definitions.impact),
  contributors: defineCollection(definitions.contributors),
  contributorDetails: defineCollection(definitions.contributorDetails),
  contributorImpact: defineCollection(definitions.contributorImpact),
  temporalDeps: defineCollection(definitions.temporalDeps),
  peopleDeps: defineCollection(definitions.peopleDeps),
  contributorTimeline: defineCollection(definitions.contributorTimeline),
  commitsPerExtension: defineCollection(definitions.commitsPerExtension),
  landscapeOverview: defineCollection(definitions.landscapeOverview),
  landscapeRepositories: defineCollection(definitions.landscapeRepositories),
  landscapeContributors: defineCollection(definitions.landscapeContributors),
  landscapeTeams: defineCollection(definitions.landscapeTeams),
  landscapeTopology: defineCollection(definitions.landscapeTopology),
  landscapeTags: defineCollection(definitions.landscapeTags),
  landscapeDependencyAlerts: defineCollection(definitions.landscapeDependencyAlerts),
  landscapeDependencyHealth: defineCollection(definitions.landscapeDependencyHealth),
  landscapeTagMatrix: defineCollection(definitions.landscapeTagMatrix),
}
