import type { CodeConfiguration } from "../core/CodeConfiguration.js";
import { Range } from "../core/Range.js";
import { Metric } from "../metrics/Metric.js";
import type { MetricsList } from "../metrics/MetricsList.js";
import type { MetricsWithGoalType } from "../metrics/MetricsWithGoal.js";
import type { CodeAnalysisResults } from "../results/CodeAnalysisResults.js";
import { ControlStatus } from "../results/ControlStatus.js";
import type { ControlsAnalysisResults } from "../results/ControlsAnalysisResults.js";
import type { GoalsAnalysisResults } from "../results/GoalsAnalysisResults.js";
import { GoalsAnalysisResults as GoalsResults } from "../results/GoalsAnalysisResults.js";

export class ControlsAnalyzer {
	private codeConfiguration: CodeConfiguration;
	private metricsList: MetricsList;
	private controlsResults: ControlsAnalysisResults;

	constructor(results: CodeAnalysisResults) {
		this.controlsResults = results.controlResults;
		this.codeConfiguration = results.codeConfiguration!;
		this.metricsList = results.metricsList;
	}

	analyze(): void {
		const goalsAndControls = this.codeConfiguration.goalsAndControls;
		const result = ControlsAnalyzer.analyzeGoals(
			goalsAndControls,
			this.metricsList,
		);
		this.controlsResults.goalsAnalysisResults.push(...result);
	}

	static analyzeGoals(
		goalsAndControls: MetricsWithGoalType[],
		metricsList: MetricsList,
	): GoalsAnalysisResults[] {
		const result: GoalsAnalysisResults[] = [];

		for (const goal of goalsAndControls) {
			const goalsResults = new GoalsResults();
			goalsResults.metricsWithGoal = goal;

			for (const control of goal.controls) {
				const metric = metricsList.getMetricById(control.metric);
				const controlStatus = new ControlStatus();
				controlStatus.control = control;

				if (!metric) {
					const notFoundMetric = new Metric();
					notFoundMetric.setId(control.metric);
					controlStatus.metric = notFoundMetric;
					controlStatus.status = "IGNORED: the metric not found";
				} else {
					controlStatus.metric = metric;
					const inRange = Range.isInRange(control.desiredRange, metric.value);
					const inRangeWithTolerance = Range.isInRangeWithTolerance(
						control.desiredRange,
						metric.value,
					);
					controlStatus.status = inRange
						? "OK"
						: inRangeWithTolerance
							? "TOLERANT"
							: "FAILED";
				}

				goalsResults.controlStatuses.push(controlStatus);
			}

			result.push(goalsResults);
		}

		return result;
	}
}
