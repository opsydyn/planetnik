import { describe, expect, test } from "bun:test";
import { buildReportSecurityViewModel } from "./report-security-view-model.js";

describe("report security view model", () => {
	test("builds hosted landscape security summary cards and rows", () => {
		const viewModel = buildReportSecurityViewModel({
			reportName: "Platform Landscape",
			security: {
				totalRepos: 3,
				reposWithAlerts: 2,
				totalAlerts: 8,
				totalOpenAlerts: 5,
				severityCounts: {
					critical: 1,
					high: 2,
					medium: 1,
					low: 1,
				},
				meanTimeToResolveDays: 14,
				supplyChainExposureScore: 0.67,
				sharedVulnerablePackages: [
					{
						ecosystem: "npm",
						name: "lodash",
						severity: "high",
						affectedRepos: ["web-app", "api"],
					},
				],
				repoHealth: [
					{
						owner: "acme",
						repo: "web-app",
						repoKey: "acme__web-app",
						totalAlerts: 5,
						openAlerts: 3,
						fixedAlerts: 2,
						severityCounts: {
							critical: 1,
							high: 1,
							medium: 1,
							low: 0,
						},
						meanTimeToResolveDays: 21,
						oldestOpenAlertDays: 40,
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Platform Landscape");
		expect(viewModel.subtitle).toBe(
			"Dependabot vulnerability health across the linked landscape dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Total Alerts", value: "8", detail: null },
			{ label: "Open Alerts", value: "5", detail: null },
			{ label: "Critical", value: "1", detail: null },
			{ label: "Repos with Alerts", value: "2/3", detail: null },
			{ label: "MTTR", value: "14d", detail: null },
			{ label: "Exposure", value: "67%", detail: null },
		]);
		expect(viewModel.repoRows).toEqual([
			{
				label: "web-app",
				value: "3 open · 1 critical · 1 high · MTTR 21d",
			},
		]);
		expect(viewModel.packageRows).toEqual([
			{
				label: "lodash",
				value: "npm · high · web-app, api",
			},
		]);
	});
});
