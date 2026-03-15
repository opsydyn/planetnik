import type { ContributionTimeSlot } from "../contributors/ContributionTimeSlot.js"
import type { Contributor } from "../contributors/Contributor.js"
import type { ComponentDependency } from "../dependencies/ComponentDependency.js"

export class ContributorsAnalysisResults {
  latestCommitDate: string = ""
  contributors: Contributor[] = []
  contributorsPerYear: ContributionTimeSlot[] = []
  contributorsPerMonth: ContributionTimeSlot[] = []
  contributorsPerDay: ContributionTimeSlot[] = []
  contributorsPerWeek: ContributionTimeSlot[] = []

  peopleDependencies30Days: ComponentDependency[] = []
  peopleDependencies90Days: ComponentDependency[] = []
  peopleDependencies180Days: ComponentDependency[] = []
  peopleDependencies365Days: ComponentDependency[] = []
}
