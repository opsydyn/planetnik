import { describe, expect, test } from "bun:test";
import {
	buildReportDetailViewModel,
	shouldRedirectReportDetail,
} from "./report-detail-view-model.js";

describe("report detail view model", () => {
	test("signals redirect when runtime report detail is missing", () => {
		expect(shouldRedirectReportDetail(null)).toBe(true);
	});

	test("builds single-repository report detail copy and facts", () => {
		const viewModel = buildReportDetailViewModel({
			report: {
				id: "report-1",
				workspaceId: "workspace-1",
				slug: "effect-ts",
				name: "Effect TS",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/effect-ts/data",
				createdAt: "2026-04-02T17:20:19.145Z",
				updatedAt: "2026-04-02T17:20:19.145Z",
				lastSyncedAt: "2026-04-02T17:20:19.145Z",
			},
			context: {
				mode: "single_repository",
				reportMode: "single_repository",
				title: "Effect TS",
				rootRoute: "/",
				dataVersion: 1,
				source: "analysisResults",
				hasLandscape: false,
				hasSingleRepositoryAnalysis: true,
				primaryNavigation: ["overview", "files", "contributors"],
			},
			artifact: {
				kind: "single_repository",
				projectName: "Effect TS",
				filesCount: 240,
				linesOfCode: 52000,
				duplicatedLines: 910,
				duplicationPercentage: 1.8,
			},
		});

		expect(viewModel.linkDescription).toBe(
			"This report is linked to a single repository dataset.",
		);
		expect(viewModel.contextTitle).toBe("Effect TS");
		expect(viewModel.artifactTitle).toBe("Effect TS");
		expect(viewModel.artifactFacts).toEqual([
			{ label: "Files", value: "240" },
			{ label: "Lines of code", value: "52,000" },
			{ label: "Duplicated lines", value: "910" },
			{ label: "Duplication", value: "1.8%" },
		]);
		expect(viewModel.navigationItems).toEqual([
			"overview",
			"files",
			"contributors",
		]);
	});

	test("builds landscape report detail copy and facts", () => {
		const viewModel = buildReportDetailViewModel({
			report: {
				id: "report-2",
				workspaceId: "workspace-1",
				slug: "platform-landscape",
				name: "Platform Landscape",
				kind: "planetnik-report",
				status: "connected",
				analysisRoot: "/datasets/platform-landscape/data",
				createdAt: "2026-04-02T17:20:19.145Z",
				updatedAt: "2026-04-02T17:20:19.145Z",
				lastSyncedAt: "2026-04-02T17:20:19.145Z",
			},
			context: {
				mode: "landscape",
				reportMode: "landscape",
				title: "Platform Landscape",
				rootRoute: "/landscape",
				dataVersion: 1,
				source: "landscape",
				hasLandscape: true,
				hasSingleRepositoryAnalysis: false,
				primaryNavigation: ["overview", "repositories"],
			},
			artifact: {
				kind: "landscape",
				title: "Landscape Overview",
				landscapeName: "Platform Landscape",
				repositoryCount: 12,
				contributorCount: 34,
				totalLinesOfCode: 91234,
				commits30d: 87,
				commits90d: 241,
			},
		});

		expect(viewModel.linkDescription).toBe(
			"This report is linked to a landscape dataset.",
		);
		expect(viewModel.artifactTitle).toBe("Platform Landscape");
		expect(viewModel.artifactFacts).toEqual([
			{ label: "Repositories", value: "12" },
			{ label: "Contributors", value: "34" },
			{ label: "Total lines of code", value: "91,234" },
			{ label: "Recent commits", value: "30d: 87 · 90d: 241" },
		]);
		expect(viewModel.navigationItems).toEqual(["overview", "repositories"]);
	});
});
