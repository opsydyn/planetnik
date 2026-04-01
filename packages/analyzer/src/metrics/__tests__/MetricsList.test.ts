import { describe, expect, test } from "bun:test";
import { MetricsList } from "../MetricsList";
import { RiskDistributionStats } from "../RiskDistributionStats";

describe("MetricsList", () => {
	test("addMetric creates and tracks metric", () => {
		const list = new MetricsList();
		list
			.addMetric()
			.setId("LOC")
			.setValue(1000)
			.setDescription("Lines of code");
		expect(list.metrics.length).toBe(1);
		expect(list.metrics[0]!.id).toBe("LOC");
		expect(list.metrics[0]!.value).toBe(1000);
	});

	test("getMetricById finds metric", () => {
		const list = new MetricsList();
		list.addMetric().setId("LOC").setValue(100);
		list.addMetric().setId("FILES").setValue(10);
		const metric = list.getMetricById("FILES");
		expect(metric?.value).toBe(10);
	});

	test("remove deletes metric by id", () => {
		const list = new MetricsList();
		list.addMetric().setId("LOC").setValue(100);
		list.remove("LOC");
		expect(list.metrics.length).toBe(0);
	});
});

describe("RiskDistributionStats", () => {
	test("update buckets values correctly", () => {
		const stats = new RiskDistributionStats(10, 20, 50, 100);
		stats.update(5, 100); // negligible
		stats.update(15, 200); // low
		stats.update(30, 300); // medium
		stats.update(75, 400); // high
		stats.update(150, 500); // very high

		expect(stats.negligibleRiskValue).toBe(100);
		expect(stats.lowRiskValue).toBe(200);
		expect(stats.mediumRiskValue).toBe(300);
		expect(stats.highRiskValue).toBe(400);
		expect(stats.veryHighRiskValue).toBe(500);
		expect(stats.getTotalValue()).toBe(1500);
		expect(stats.getTotalCount()).toBe(5);
	});

	test("calculates percentages", () => {
		const stats = new RiskDistributionStats(10, 20, 50, 100);
		stats.update(5, 50);
		stats.update(150, 50);
		expect(stats.getNegligibleRiskPercentage()).toBe(50);
		expect(stats.getVeryHighRiskPercentage()).toBe(50);
	});

	test("reset clears all accumulators", () => {
		const stats = new RiskDistributionStats(10, 20, 50, 100);
		stats.update(5, 100);
		stats.reset();
		expect(stats.getTotalValue()).toBe(0);
		expect(stats.getTotalCount()).toBe(0);
	});
});
