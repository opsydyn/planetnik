import { describe, expect, test } from "bun:test";
import { buildContributorHeatmap } from "../contributorHeatmap";

describe("buildContributorHeatmap", () => {
	test("maps daily activity into week columns and day bins", () => {
		const heatmap = buildContributorHeatmap(
			[
				{ date: "2025-01-01", commits: 2 },
				{ date: "2025-01-12", commits: 1 },
				{ date: "2025-01-12", commits: 3 },
			],
			{ endDate: "2025-01-12", weeks: 2 },
		);

		expect(heatmap.startDate).toBe("2024-12-30");
		expect(heatmap.endDate).toBe("2025-01-12");
		expect(heatmap.totalCommits).toBe(6);
		expect(heatmap.activeDays).toBe(2);
		expect(heatmap.maxCommits).toBe(4);
		expect(heatmap.weeks).toHaveLength(2);
		expect(heatmap.weeks[0]?.bins[2]).toMatchObject({
			date: "2025-01-01",
			commits: 2,
		});
		expect(heatmap.weeks[1]?.bins[6]).toMatchObject({
			date: "2025-01-12",
			commits: 4,
		});
	});

	test("creates month labels when the grid crosses into a new month", () => {
		const heatmap = buildContributorHeatmap(
			[
				{ date: "2025-01-28", commits: 1 },
				{ date: "2025-02-03", commits: 2 },
			],
			{ endDate: "2025-02-09", weeks: 3 },
		);

		expect(heatmap.monthLabels).toEqual([
			{ weekIndex: 0, label: "Jan" },
			{ weekIndex: 1, label: "Feb" },
		]);
	});
});
