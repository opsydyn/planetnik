import type { MetricsWithGoalType } from "../metrics/MetricsWithGoal.js";
import type { ControlStatus } from "./ControlStatus.js";

export class GoalsAnalysisResults {
	metricsWithGoal: MetricsWithGoalType | null = null;
	controlStatuses: ControlStatus[] = [];
}
