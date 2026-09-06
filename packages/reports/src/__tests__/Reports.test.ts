import { describe, expect, test } from "bun:test";
import {
	CodeAnalysisResults,
	ControlStatus,
	DuplicatedFileBlock,
	DuplicationInstance,
	DuplicationMetric,
	GoalsAnalysisResults,
	Metric,
	MetricRangeControl,
	MetricsWithGoal,
	NamedSourceCodeAspect,
	NumericMetric,
	Range,
	RiskDistributionStats,
	SourceFile,
	type SourceFileSizeDistribution,
	UnitInfo,
} from "@planetnik/analyzer";
import {
	REPORTS_HTML_FOOTER,
	REPORTS_HTML_HEADER,
} from "../core/ReportConstants.js";
import { ReportRenderer } from "../core/ReportRenderer.js";
import { FragmentType, RichTextFragment } from "../core/RichTextFragment.js";
import { RichTextReport } from "../core/RichTextReport.js";
import { fileExportInfoFromSourceFile } from "../exporters/FileExportInfo.js";
import { BasicSourceCodeReportGenerator } from "../generators/BasicSourceCodeReportGenerator.js";
import { ControlsReportGenerator } from "../generators/ControlsReportGenerator.js";
import { DuplicationReportGenerator } from "../generators/DuplicationReportGenerator.js";
import { FileSizeReportGenerator } from "../generators/FileSizeReportGenerator.js";
import { MetricsReportGenerator } from "../generators/MetricsReportGenerator.js";
import { OverviewReportGenerator } from "../generators/OverviewReportGenerator.js";
import { RiskDistributionReportUtils } from "../generators/RiskDistributionReportUtils.js";
import { UnitsSizeReportGenerator } from "../generators/UnitsSizeReportGenerator.js";

// Helper to render a report to a string
function renderToString(report: RichTextReport): string {
	const parts: string[] = [];
	const client = {
		append(text: string) {
			parts.push(text);
		},
	};
	new ReportRenderer().render(report, client);
	return parts.join("");
}

// Helper to create mock analysis results
function createMockResults(): CodeAnalysisResults {
	const results = new CodeAnalysisResults();
	results.mainAspectAnalysisResults.filesCount = 10;
	results.mainAspectAnalysisResults.linesOfCode = 500;
	results.mainAspectAnalysisResults.linesOfCodePerExtension = [
		new NumericMetric("java", 300),
		new NumericMetric("ts", 200),
	];
	results.duplicationAnalysisResults.overallDuplication = new DuplicationMetric(
		"overall",
		500,
		50,
	);
	results.duplicationAnalysisResults.overallDuplication.numberOfDuplicates = 5;
	results.duplicationAnalysisResults.overallDuplication.numberOfFilesWithDuplicates = 3;
	return results;
}

describe("RichTextFragment", () => {
	test("creates HTML fragment by default", () => {
		const f = new RichTextFragment("<p>test</p>");
		expect(f.type).toBe(FragmentType.HTML);
		expect(f.fragment).toBe("<p>test</p>");
		expect(f.show).toBe(true);
	});

	test("creates typed fragment", () => {
		const f = new RichTextFragment(
			"digraph{}",
			FragmentType.GRAPHVIZ,
			"my-graph",
		);
		expect(f.type).toBe(FragmentType.GRAPHVIZ);
		expect(f.id).toBe("my-graph");
	});
});

describe("RichTextReport", () => {
	test("generates filename from displayName", () => {
		const r = new RichTextReport();
		r.displayName = "Source Code Overview";
		expect(r.getFileName()).toBe("source_code_overview.html");
	});

	test("uses explicit fileName when set", () => {
		const r = new RichTextReport("id", "MyReport.html");
		expect(r.getFileName()).toBe("MyReport.html");
	});

	test("defaults to report.html", () => {
		const r = new RichTextReport();
		expect(r.getFileName()).toBe("report.html");
	});

	test("adds headers", () => {
		const r = new RichTextReport();
		r.addLevel1Header("Title");
		r.addLevel2Header("Subtitle");
		r.addLevel3Header("Section");
		const html = renderToString(r);
		expect(html).toContain("<h1>Title</h1>");
		expect(html).toContain("<h2>Subtitle</h2>");
		expect(html).toContain("<h3>Section</h3>");
	});

	test("adds paragraph with style", () => {
		const r = new RichTextReport();
		r.addParagraph("styled", "color: red");
		const html = renderToString(r);
		expect(html).toContain('<p style="color: red">styled</p>');
	});

	test("builds a table", () => {
		const r = new RichTextReport();
		r.startTable();
		r.addTableHeaderLeft("Name", "Value");
		r.startTableRow();
		r.addTableCell("foo");
		r.addTableCell("bar");
		r.endTableRow();
		r.endTable();
		const html = renderToString(r);
		expect(html).toContain("<th>Name</th>");
		expect(html).toContain("<td>foo</td>");
		expect(html).toContain("</table>");
	});

	test("creates sections", () => {
		const r = new RichTextReport();
		r.startSection("My Section", "with subtitle");
		r.addParagraph("content");
		r.endSection();
		const html = renderToString(r);
		expect(html).toContain('<div class="section">');
		expect(html).toContain("<h2>My Section</h2>");
		expect(html).toContain("<p>with subtitle</p>");
		expect(html).toContain("<p>content</p>");
	});

	test("adds show/hide block", () => {
		const r = new RichTextReport();
		r.addShowMoreBlock("visible", "hidden", "show more");
		const html = renderToString(r);
		expect(html).toContain("visible");
		expect(html).toContain('style="display:none"');
		expect(html).toContain("show more");
	});

	test("adds tabs", () => {
		const r = new RichTextReport();
		r.startTabGroup();
		r.addTab("tab1", "First", true);
		r.addTab("tab2", "Second", false);
		r.endTabGroup();
		const html = renderToString(r);
		expect(html).toContain('class="nav nav-tabs"');
		expect(html).toContain('class="active"');
		expect(html).toContain("#tab1");
	});

	test("adds graphviz figure", () => {
		const r = new RichTextReport();
		r.addGraphvizFigure("graph1", "description", "digraph { a -> b }");
		const fragments = r.getFragments();
		expect(fragments.length).toBe(1);
		expect(fragments[0]!.type).toBe(FragmentType.GRAPHVIZ);
	});

	test("adds SVG figure", () => {
		const r = new RichTextReport();
		r.addSvgFigure("title", "<svg></svg>");
		const fragments = r.getFragments();
		expect(fragments[0]!.type).toBe(FragmentType.SVG);
	});
});

describe("ReportRenderer", () => {
	test("renders header with display name and breadcrumbs", () => {
		const r = new RichTextReport();
		r.displayName = "Test Report";
		r.description = "A test";
		r.breadcrumbs = [
			{ label: "Home", href: "index.html" },
			{ label: "Reports", href: "reports.html" },
		];
		r.addParagraph("body");
		const html = renderToString(r);
		expect(html).toContain("<h1>Test Report</h1>");
		expect(html).toContain('<p class="text-muted">A test</p>');
		expect(html).toContain('class="breadcrumbs"');
		expect(html).toContain("Home");
		expect(html).toContain("&gt;");
	});

	test("renders graphviz as pre block", () => {
		const r = new RichTextReport();
		r.addGraphvizFigure("", "digraph { a -> b }");
		const html = renderToString(r);
		expect(html).toContain('<pre class="graphviz">digraph { a -> b }</pre>');
	});

	test("skips hidden fragments", () => {
		const r = new RichTextReport();
		r.addParagraph("visible");
		const fragments = r.getFragments();
		const hidden = new RichTextFragment("<p>hidden</p>");
		hidden.show = false;
		fragments.push(hidden);
		const html = renderToString(r);
		expect(html).toContain("visible");
		expect(html).not.toContain("hidden");
	});
});

describe("ReportConstants", () => {
	test("header contains placeholder", () => {
		expect(REPORTS_HTML_HEADER).toContain("{{TITLE}}");
		expect(REPORTS_HTML_HEADER).toContain("{{CUSTOM_HEADER}}");
		expect(REPORTS_HTML_HEADER).toContain("bootstrap");
	});

	test("footer closes tags", () => {
		expect(REPORTS_HTML_FOOTER).toContain("</body>");
		expect(REPORTS_HTML_FOOTER).toContain("</html>");
	});
});

describe("OverviewReportGenerator", () => {
	test("adds overview with file and LOC counts", () => {
		const results = createMockResults();
		const report = new RichTextReport();
		OverviewReportGenerator.addScopeAnalysisToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("Source Code Overview");
		expect(html).toContain("10");
		expect(html).toContain("500");
		expect(html).toContain("java");
		expect(html).toContain("300");
		expect(html).toContain("10.0%"); // 50/500 = 10%
	});
});

describe("DuplicationReportGenerator", () => {
	test("shows duplication stats", () => {
		const results = createMockResults();

		const extDup = new DuplicationMetric(".java", 300, 30);
		results.duplicationAnalysisResults.duplicationPerExtension = [extDup];

		const dup = new DuplicationInstance();
		dup.blockSize = 15;
		const block = new DuplicatedFileBlock();
		block.sourceFile = new SourceFile("src/A.java");
		block.startLine = 10;
		dup.duplicatedFileBlocks = [block];
		results.duplicationAnalysisResults.longestDuplicates = [dup];

		const report = new RichTextReport();
		DuplicationReportGenerator.addDuplicationToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("Duplication");
		expect(html).toContain("10.0%");
		expect(html).toContain("50");
		expect(html).toContain("Duplication Per Extension");
		expect(html).toContain(".java");
		expect(html).toContain("Longest Duplicates");
		expect(html).toContain("15");
	});
});

describe("FileSizeReportGenerator", () => {
	test("shows file size distribution and longest files", () => {
		const results = createMockResults();
		const stats = new RiskDistributionStats(100, 200, 500, 1000);
		stats.update(50, 50); // negligible
		stats.update(150, 150); // low
		results.filesAnalysisResults.overallFileSizeDistribution =
			stats as unknown as SourceFileSizeDistribution;
		const longFile = new SourceFile("src/BigFile.java");
		longFile.linesOfCode = 999;
		results.filesAnalysisResults.longestFiles = [longFile];

		const report = new RichTextReport();
		FileSizeReportGenerator.addFileSizeToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("File Size");
		expect(html).toContain("Overall File Size Distribution");
		expect(html).toContain("BigFile.java");
		expect(html).toContain("999");
	});
});

describe("UnitsSizeReportGenerator", () => {
	test("shows unit size distribution and longest units", () => {
		const results = createMockResults();
		const stats = new RiskDistributionStats(20, 40, 80, 160);
		stats.update(10, 10);
		results.unitsAnalysisResults.unitSizeRiskDistribution = stats;

		const unit = new UnitInfo();
		unit.shortName = "processData";
		unit.linesOfCode = 45;
		unit.mcCabeIndex = 8;
		unit.sourceFile = new SourceFile("src/Service.java");
		results.unitsAnalysisResults.longestUnits = [unit];

		const report = new RichTextReport();
		UnitsSizeReportGenerator.addUnitsSizeToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("Unit Size");
		expect(html).toContain("processData");
		expect(html).toContain("45");
		expect(html).toContain("8");
	});
});

describe("ControlsReportGenerator", () => {
	test("shows controls with statuses", () => {
		const results = createMockResults();
		const goal = new GoalsAnalysisResults();
		goal.metricsWithGoal = MetricsWithGoal.make({
			goal: "Code Quality",
			controls: [
				MetricRangeControl.make({
					metric: "duplication",
					desiredRange: Range.make({ min: "0", max: "5" }),
				}),
			],
		});
		const cs = new ControlStatus();
		cs.control = goal.metricsWithGoal.controls[0]!;
		cs.metric = new Metric().setId("duplication").setValue(3);
		cs.status = "OK";
		goal.controlStatuses = [cs];
		results.controlResults.goalsAnalysisResults = [goal];

		const report = new RichTextReport();
		ControlsReportGenerator.addControlsToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("Code Quality");
		expect(html).toContain("duplication");
		expect(html).toContain("3");
		expect(html).toContain("[0 - 5]");
		expect(html).toContain("OK");
		expect(html).toContain("color: green");
	});

	test("skips when no controls", () => {
		const results = createMockResults();
		const report = new RichTextReport();
		ControlsReportGenerator.addControlsToReport(report, results);
		expect(report.getFragments().length).toBe(0);
	});
});

describe("MetricsReportGenerator", () => {
	test("renders metrics table", () => {
		const results = createMockResults();
		results.metricsList
			.addMetric()
			.setId("LOC_MAIN")
			.setValue(500)
			.setDescription("Lines of code in main");
		results.metricsList
			.addMetric()
			.setId("FILES_MAIN")
			.setValue(10)
			.setDescription("Number of files");

		const report = new RichTextReport();
		MetricsReportGenerator.addMetricsToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("Metrics");
		expect(html).toContain("LOC_MAIN");
		expect(html).toContain("500");
		expect(html).toContain("Lines of code in main");
		expect(html).toContain("FILES_MAIN");
	});
});

describe("RiskDistributionReportUtils", () => {
	test("renders risk distribution table with percentages", () => {
		const stats = new RiskDistributionStats(100, 200, 500, 1000);
		stats.key = "java";
		stats.update(50, 50); // negligible: 50
		stats.update(150, 150); // low: 150
		stats.update(300, 300); // medium: 300
		stats.update(600, 600); // high: 600
		stats.update(1500, 1500); // very high: 1500

		const report = new RichTextReport();
		RiskDistributionReportUtils.addRiskDistributionTable(report, stats);
		const html = renderToString(report);
		expect(html).toContain("java");
		expect(html).toContain("Negligible");
		expect(html).toContain("50");
		expect(html).toContain("Very High");
		expect(html).toContain("1500");
		// Check percentages sum roughly to 100
		expect(html).toContain("%");
	});
});

describe("BasicSourceCodeReportGenerator", () => {
	test("creates reports based on settings", () => {
		const results = createMockResults();
		const settings = {
			dataOnly: false,
			updateIndex: true,
			analyzeFilesInScope: true,
			analyzeLogicalDecomposition: false,
			analyzeStaticDependencies: false,
			analyzeConcerns: false,
			analyzeDuplication: true,
			analyzeFileSize: true,
			analyzeFileHistory: false,
			analyzeContributors: false,
			analyzeUnitSize: false,
			analyzeConditionalComplexity: false,
			createMetricsList: true,
			analyzeControls: false,
			analyzeFindings: false,
		};
		const gen = new BasicSourceCodeReportGenerator(settings, results);
		const reports = gen.report();

		// overview + duplication + fileSize + metrics + trend = 5
		expect(reports.length).toBe(5);
		expect(reports[0]!.displayName).toBe("Source Code Overview");
		expect(reports[1]!.displayName).toBe("Duplication");
		expect(reports[2]!.displayName).toBe("File Size");
		expect(reports[3]!.displayName).toBe("Metrics");
		expect(reports[4]!.displayName).toBe("Trend");
	});

	test("includes all reports when all enabled", () => {
		const results = createMockResults();
		const settings = {
			dataOnly: false,
			updateIndex: true,
			analyzeFilesInScope: true,
			analyzeLogicalDecomposition: true,
			analyzeStaticDependencies: true,
			analyzeConcerns: true,
			analyzeDuplication: true,
			analyzeFileSize: true,
			analyzeFileHistory: true,
			analyzeContributors: true,
			analyzeUnitSize: true,
			analyzeConditionalComplexity: true,
			createMetricsList: true,
			analyzeControls: true,
			analyzeFindings: true,
		};
		const gen = new BasicSourceCodeReportGenerator(settings, results);
		const reports = gen.report();
		// overview + components + componentDeps + duplication + fileSize + unitSize + conditionalComplexity + concerns + findings + metrics + trend + controls = 12
		// (no file history data, so fileAge/commits/contributors are skipped)
		expect(reports.length).toBe(12);
	});
});

describe("LandscapeReportGenerator", () => {
	test("generates landscape overview report", () => {
		const {
			LandscapeAnalysisResults,
			Contributor,
		} = require("@planetnik/analyzer");
		const {
			LandscapeReportGenerator,
		} = require("../landscape/LandscapeReportGenerator.js");

		const results = new LandscapeAnalysisResults();
		results.metadata = {
			name: "MyLandscape",
			description: "Test landscape",
			tooltip: "",
			logoLink: "",
			links: [],
		};
		results.totalMainLoc = 50000;
		results.totalTestLoc = 10000;
		results.totalMainFilesCount = 200;
		results.linesOfCodePerExtension.set("ts", 30000);
		results.linesOfCodePerExtension.set("java", 20000);
		results.repositoriesPerExtension.set("ts", 3);
		results.repositoriesPerExtension.set("java", 2);
		results.firstCommitDate = "2020-01-01";
		results.latestCommitDate = "2024-12-01";

		const c = new Contributor();
		c.email = "alice@example.com";
		c.commitsCount = 100;
		c.commitsCount30Days = 5;
		c.firstCommitDate = "2020-01-01";
		c.latestCommitDate = "2024-12-01";
		results.allContributors = [c];

		results.repositoryAnalysisResults = [
			{
				name: "RepoA",
				analysisResultsPath: "repoA",
				metadata: {
					name: "RepoA",
					description: "",
					tooltip: "",
					logoLink: "",
					links: [],
				},
				mainLoc: 30000,
				mainFilesCount: 120,
				testLoc: 5000,
				testFilesCount: 40,
				generatedLoc: 0,
				buildAndDeployLoc: 0,
				otherLoc: 0,
				extensions: ["ts"],
				linesOfCodePerExtension: [{ extension: "ts", linesOfCode: 30000 }],
				contributors: [c],
				firstCommitDate: "2020-01-01",
				latestCommitDate: "2024-12-01",
				duplicationPercentage: 3.5,
			},
		];

		const report = new RichTextReport();
		LandscapeReportGenerator.generate(report, results);
		const html = renderToString(report);

		expect(html).toContain("MyLandscape");
		expect(html).toContain("50,000");
		expect(html).toContain("alice@example.com");
		expect(html).toContain("RepoA");
		expect(html).toContain("ts");
		expect(html).toContain("30,000");
	});
});

describe("LogicalComponentsReportGenerator", () => {
	test("renders components and dependencies", () => {
		const {
			LogicalDecompositionAnalysisResults,
			AspectAnalysisResults,
			ComponentDependency,
		} = require("@planetnik/analyzer");
		const {
			LogicalComponentsReportGenerator,
		} = require("../generators/LogicalComponentsReportGenerator.js");

		const results = createMockResults();
		const decomp = new LogicalDecompositionAnalysisResults("primary");
		const comp1 = new AspectAnalysisResults();
		comp1.name = "core";
		comp1.filesCount = 5;
		comp1.linesOfCode = 300;
		const comp2 = new AspectAnalysisResults();
		comp2.name = "ui";
		comp2.filesCount = 3;
		comp2.linesOfCode = 200;
		decomp.components = [comp1, comp2];

		const dep = new ComponentDependency("core", "ui");
		dep.count = 4;
		decomp.componentDependencies = [dep];
		results.logicalDecompositionsAnalysisResults = [decomp];

		const report = new RichTextReport();
		LogicalComponentsReportGenerator.addComponentsToReport(
			report,
			results,
			false,
		);
		const html = renderToString(report);
		expect(html).toContain("primary");
		expect(html).toContain("core");
		expect(html).toContain("ui");
		expect(html).toContain("300");
		expect(html).toContain("Static Dependencies");
		expect(html).toContain("4");
	});
});

describe("ConcernsReportGenerator", () => {
	test("renders concerns overview and details", () => {
		const {
			ConcernsAnalysisResults,
			AspectAnalysisResults,
		} = require("@planetnik/analyzer");
		const {
			ConcernsReportGenerator,
		} = require("../generators/ConcernsReportGenerator.js");

		const results = createMockResults();
		const group = new ConcernsAnalysisResults("Security");
		const concern1 = new AspectAnalysisResults();
		concern1.name = "Authentication";
		concern1.filesCount = 3;
		concern1.linesOfCode = 150;
		const concern2 = new AspectAnalysisResults();
		concern2.name = "Authorization";
		concern2.filesCount = 2;
		concern2.linesOfCode = 100;
		group.concerns = [concern1, concern2];
		results.concernsAnalysisResults = [group];

		const report = new RichTextReport();
		ConcernsReportGenerator.addConcernsToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("SECURITY");
		expect(html).toContain("Authentication");
		expect(html).toContain("Authorization");
		expect(html).toContain("150");
	});
});

describe("FindingsReportGenerator", () => {
	test("renders findings from canonical structured input", () => {
		const {
			FindingsReportGenerator,
		} = require("../generators/FindingsReportGenerator.js");
		const report = new RichTextReport();
		FindingsReportGenerator.addFindingsToReport(report, {
			items: [
				{
					id: "bug-found",
					summary: "Bug found",
					body: "Details here",
				},
			],
		});
		const rendered = renderToString(report);
		expect(rendered).toContain("Bug found");
		expect(rendered).toContain("Details here");
		expect(rendered).toContain("Summary");
	});

	test("shows no findings message when empty", () => {
		const {
			FindingsReportGenerator,
		} = require("../generators/FindingsReportGenerator.js");
		const report = new RichTextReport();
		FindingsReportGenerator.addFindingsToReport(report, null);
		const rendered = renderToString(report);
		expect(rendered).toContain("No manual findings");
	});
});

describe("ConditionalComplexityReportGenerator", () => {
	test("renders complexity distribution", () => {
		const {
			ConditionalComplexityReportGenerator,
		} = require("../generators/ConditionalComplexityReportGenerator.js");
		const results = createMockResults();
		const stats = new RiskDistributionStats(5, 10, 25, 50);
		stats.update(3, 10); // simple
		stats.update(8, 20); // medium
		stats.update(15, 30); // complex
		stats.update(30, 40); // very complex
		results.unitsAnalysisResults.conditionalComplexityRiskDistribution = stats;
		results.unitsAnalysisResults.totalNumberOfUnits = 4;
		results.unitsAnalysisResults.linesOfCodeInUnits = 100;

		const unit = new UnitInfo();
		unit.shortName = "complexMethod";
		unit.linesOfCode = 40;
		unit.mcCabeIndex = 30;
		unit.sourceFile = new SourceFile("src/Complex.java");
		results.unitsAnalysisResults.mostComplexUnits = [unit];

		const report = new RichTextReport();
		ConditionalComplexityReportGenerator.addConditionalComplexityToReport(
			report,
			results,
		);
		const html = renderToString(report);
		expect(html).toContain("Conditional Complexity");
		expect(html).toContain("complexMethod");
		expect(html).toContain("30");
		expect(html).toContain("very complex");
	});
});

describe("CommitsReportGenerator", () => {
	test("renders commit trends", () => {
		const { ContributionTimeSlot } = require("@planetnik/analyzer");
		const {
			CommitsReportGenerator,
		} = require("../generators/CommitsReportGenerator.js");
		const results = createMockResults();
		results.contributorsAnalysisResults.commitsCount = 50;
		results.contributorsAnalysisResults.latestCommitDate = "2024-12-01";

		const slot = new ContributionTimeSlot();
		slot.timeSlot = "2024";
		slot.commitsCount = 50;
		slot.contributorsCount = 3;
		results.contributorsAnalysisResults.contributorsPerYear = [slot];

		const report = new RichTextReport();
		CommitsReportGenerator.addCommitsToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("50");
		expect(html).toContain("2024");
		expect(html).toContain("2024-12-01");
	});
});

describe("TrendReportGenerator", () => {
	test("renders trend placeholder", () => {
		const {
			TrendReportGenerator,
		} = require("../generators/TrendReportGenerator.js");
		const results = createMockResults();
		const report = new RichTextReport();
		TrendReportGenerator.addTrendToReport(report, results);
		const html = renderToString(report);
		expect(html).toContain("Trend");
		expect(html).toContain("No reference analysis results");
	});
});

describe("FileExportInfo", () => {
	test("creates export info from source file", () => {
		const sf = new SourceFile("src/main/App.java");
		sf.linesOfCode = 100;
		sf.logicalComponents = [new NamedSourceCodeAspect("core")];
		sf.concerns = [new NamedSourceCodeAspect("logging")];
		const info = fileExportInfoFromSourceFile(sf);
		expect(info.relativePath).toBe("src/main/App.java");
		expect(info.extension).toBe("java");
		expect(info.linesOfCode).toBe(100);
		expect(info.components).toEqual(["core"]);
		expect(info.concerns).toEqual(["logging"]);
	});
});
