import { describe, expect, test } from "bun:test";
import { buildReportDependenciesViewModel } from "./report-dependencies-view-model.js";

describe("report dependencies view model", () => {
	test("builds hosted dependencies summary cards and sections", () => {
		const viewModel = buildReportDependenciesViewModel({
			reportName: "Effect TS",
			dependencies: {
				sections: [
					{
						decompositionKey: "components",
						linksCount: 2,
						incoming: [
							{ label: "runtime", value: 8 },
							{ label: "reports", value: 5 },
						],
						outgoing: [
							{ label: "site", value: 8 },
							{ label: "runtime", value: 5 },
						],
						links: [
							{
								fromComponent: "site",
								toComponent: "runtime",
								count: 8,
								evidenceCount: 3,
								locFrom: 1200,
							},
							{
								fromComponent: "runtime",
								toComponent: "reports",
								count: 5,
								evidenceCount: 2,
								locFrom: 900,
							},
						],
					},
				],
			},
		});

		expect(viewModel.heading).toBe("Effect TS");
		expect(viewModel.subtitle).toBe(
			"Static component dependency summary from the linked Planetnik dataset.",
		);
		expect(viewModel.cards).toEqual([
			{ label: "Decompositions", value: "1", detail: null },
			{ label: "Component Links", value: "2", detail: null },
		]);
		expect(viewModel.sections).toEqual([
			{
				label: "components",
				detail: "2 component links",
				incoming: [
					{ label: "runtime", value: "8 incoming refs" },
					{ label: "reports", value: "5 incoming refs" },
				],
				outgoing: [
					{ label: "site", value: "8 outgoing refs" },
					{ label: "runtime", value: "5 outgoing refs" },
				],
				links: [
					{
						label: "site → runtime",
						value: "8 refs · 3 evidence · 1,200 loc from",
					},
					{
						label: "runtime → reports",
						value: "5 refs · 2 evidence · 900 loc from",
					},
				],
			},
		]);
	});
});
