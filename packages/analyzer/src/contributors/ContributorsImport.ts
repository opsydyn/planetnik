import type { ContributionTimeSlot } from "./ContributionTimeSlot.js";
import type { Contributor } from "./Contributor.js";

export class ContributorsImport {
	contributors: Contributor[] = [];
	contributorsPerYear: ContributionTimeSlot[] = [];
	contributorsPerMonth: ContributionTimeSlot[] = [];
	contributorsPerDay: ContributionTimeSlot[] = [];
	contributorsPerWeek: ContributionTimeSlot[] = [];
	rookiesPerYear: ContributionTimeSlot[] = [];
	leaversPerYear: ContributionTimeSlot[] = [];
	latestCommitDate: string = "";
	firstCommitDate: string = "";
}
