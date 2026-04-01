import type { Concern } from "../aspects/Concern.js";
import type { AnalysisConfigType } from "../core/AnalysisConfig.js";
import type { FileHistoryAnalysisConfig } from "../core/FileHistoryAnalysisConfig.js";
import type { TagRuleType } from "../core/TagRule.js";
import type { TrendAnalysisConfig } from "../core/TrendAnalysisConfig.js";
import type { MetricsWithGoalType } from "../metrics/MetricsWithGoal.js";
import type { Convention } from "./Convention.js";
import { CustomExtensionConventions } from "./CustomExtensionConventions.js";

export class CustomScopingConventions {
	extensions: CustomExtensionConventions = new CustomExtensionConventions();
	ignoreStandardScopingConventions: boolean = false;
	removeStandardConcerns: boolean = false;
	logoLink: string = "";
	ignoredFilesConventions: Convention[] = [];
	testFilesConventions: Convention[] = [];
	generatedFilesConventions: Convention[] = [];
	buildAndDeploymentFilesConventions: Convention[] = [];
	otherFilesConventions: Convention[] = [];
	concerns: Concern[] = [];
	ignoreContributors: string[] = [];
	bots: string[] = [];
	componentsFolderDepth: number = 1;
	minComponentsCount: number = 0;
	ignoreStandardControls: boolean = false;
	goalsAndControls: MetricsWithGoalType[] = [];
	trendAnalysis: TrendAnalysisConfig | null = null;
	fileHistoryAnalysis: FileHistoryAnalysisConfig | null = null;
	analysis: AnalysisConfigType | null = null;
	tagRules: TagRuleType[] = [];
}
