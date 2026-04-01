import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type {
	CodeAnalysisResults,
	ComponentDependency,
	Contributor,
	DuplicationInstance,
	SourceFile,
	UnitInfo,
} from "@planetnik/analyzer";
import { Range } from "@planetnik/analyzer";
import { FormattingUtils } from "@planetnik/common";
import { ComponentDependenciesExporter } from "./ComponentDependenciesExportInfo.js";
import { ContributorImpactExporter } from "./ContributorImpactExportInfo.js";
import { DataExportUtils } from "./DataExportUtils.js";
import { DependenciesExporter } from "./DependenciesExportInfo.js";
import { DuplicationExporter } from "./DuplicationExportInfo.js";
import { FileListExporter } from "./FilesExportInfo.js";
import {
	ImpactExporter,
	type ImpactSourceHotspot,
} from "./ImpactExportInfo.js";
import { TemporalDependenciesExporter } from "./TemporalDependenciesExportInfo.js";
import { UnitListExporter } from "./UnitsExportInfo.js";

export class DataExporter {
	static readonly DATA_FOLDER_NAME = "data";
	static readonly SEPARATOR =
		"- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n";
	static readonly MAX_EXPORT_LIST_SIZE = 10000;

	private analysisResults: CodeAnalysisResults;
	private reportsFolder: string;
	private findingsHtml: string | null;

	constructor(
		analysisResults: CodeAnalysisResults,
		reportsFolder: string,
		findingsHtml: string | null = null,
	) {
		this.analysisResults = analysisResults;
		this.reportsFolder = reportsFolder;
		this.findingsHtml = findingsHtml;
	}

	exportData(): void {
		const dataFolder = join(this.reportsFolder, DataExporter.DATA_FOLDER_NAME);
		if (!existsSync(dataFolder)) {
			mkdirSync(dataFolder, { recursive: true });
		}

		this.exportFileLists(dataFolder);
		this.exportMetrics(dataFolder);
		this.exportControls(dataFolder);
		this.exportFindings(dataFolder);
		const hotspotData = this.buildHotspotData();
		this.exportHotspots(dataFolder, hotspotData);
		this.exportImpact(dataFolder, hotspotData);
		this.exportContributorImpact(dataFolder, hotspotData);
		this.exportContributors(dataFolder);
		this.exportContributorDetails(dataFolder);
		this.exportJson(dataFolder);
		this.exportDuplicates(dataFolder);
		this.exportUnits(dataFolder);
		this.exportDependencies(dataFolder);
		this.exportTemporalDependencies(dataFolder);
		this.exportPeopleDependencies(dataFolder);
		this.exportCommitsPerExtension(dataFolder);
		this.exportContributorTimeline(dataFolder);
	}

	private exportFileLists(dataFolder: string): void {
		const config = this.analysisResults.codeConfiguration;
		if (!config) return;

		const timestamp = new Date().toISOString();
		const srcRoot = config.srcRoot ?? "";

		const mainFiles = config.main.sourceFiles ?? [];
		if (mainFiles.length > 0) {
			const fileExport = FileListExporter.exportFiles(
				mainFiles,
				"Main",
				srcRoot,
				timestamp,
			);
			writeFileSync(
				join(dataFolder, "files_main.json"),
				JSON.stringify(fileExport, null, 2),
				"utf-8",
			);
		}

		const testFiles = config.test?.sourceFiles ?? [];
		if (testFiles.length > 0) {
			const fileExport = FileListExporter.exportFiles(
				testFiles,
				"Test",
				srcRoot,
				timestamp,
			);
			writeFileSync(
				join(dataFolder, "files_test.json"),
				JSON.stringify(fileExport, null, 2),
				"utf-8",
			);
		}

		// Export simple file list (tab-separated)
		const allFiles = mainFiles;
		const fileList = allFiles
			.map((f) => `${f.relativePath}\t${f.linesOfCode}\t${f.extension}`)
			.join("\n");
		writeFileSync(join(dataFolder, "files.txt"), fileList, "utf-8");

		// Export per-component file lists
		for (const decomposition of this.analysisResults
			.logicalDecompositionsAnalysisResults) {
			for (const component of decomposition.components) {
				const aspect = component.aspect;
				if (aspect) {
					const prefix = DataExportUtils.getComponentFileName(
						"component_files_",
						decomposition.key,
					);
					const content = aspect.sourceFiles
						.sort((a, b) => a.relativePath.localeCompare(b.relativePath))
						.map((f) => `${f.relativePath}\t${f.linesOfCode}`)
						.join("\n");
					writeFileSync(
						join(
							dataFolder,
							`${prefix}_${DataExportUtils.getAspectFileName("", aspect.name)}.txt`,
						),
						`Path\tLines of Code\n${content}`,
						"utf-8",
					);
				}
			}
		}
	}

	private exportMetrics(dataFolder: string): void {
		const lines = this.analysisResults.metricsList.metrics
			.map((m) => `${m.id}: ${m.value}`)
			.join("\n");
		writeFileSync(join(dataFolder, "metrics.txt"), lines, "utf-8");
	}

	private exportControls(dataFolder: string): void {
		const lines: string[] = [];
		const goals = this.analysisResults.controlResults.goalsAnalysisResults.map(
			(goal) => ({
				goal: goal.metricsWithGoal?.goal ?? "Controls",
				description: goal.metricsWithGoal?.description ?? "",
				controls: goal.controlStatuses.map((status) => ({
					metricId: status.control?.metric ?? "",
					metricValue: status.metric?.value ?? null,
					metricDescription: status.metric?.description ?? "",
					desiredRange: status.control?.desiredRange ?? Range.make({}),
					desiredRangeText: status.control
						? Range.getTextDescription(status.control.desiredRange)
						: "",
					status: status.status,
					controlDescription: status.control?.description ?? "",
				})),
			}),
		);

		for (const goal of this.analysisResults.controlResults
			.goalsAnalysisResults) {
			for (const status of goal.controlStatuses) {
				if (goal.metricsWithGoal) {
					lines.push(`goal: ${goal.metricsWithGoal.goal}`);
				}
				if (status.metric) {
					lines.push(`control metric: ${status.metric.id}`);
				}
				lines.push(`status: ${status.status}`);
				if (status.control) {
					lines.push(
						`desired range: ${Range.getTextDescription(status.control.desiredRange)}`,
					);
					lines.push(`description: ${status.control.description}`);
				}
				if (status.metric) {
					lines.push(`value: ${status.metric.value}`);
				}
				lines.push("");
			}
		}

		writeFileSync(
			join(dataFolder, "controls.json"),
			JSON.stringify(
				{
					title: "Goals & Controls",
					timestamp: new Date().toISOString(),
					goals,
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(join(dataFolder, "controls.txt"), lines.join("\n"), "utf-8");
	}

	private exportFindings(dataFolder: string): void {
		const findings = this.extractFindings(this.findingsHtml);

		writeFileSync(
			join(dataFolder, "findings.json"),
			JSON.stringify(
				{
					title: "Notes & Findings",
					timestamp: new Date().toISOString(),
					items: findings,
				},
				null,
				2,
			),
			"utf-8",
		);
	}

	private exportHotspots(
		dataFolder: string,
		hotspotData: {
			fileHotspots: ImpactSourceHotspot[];
			unitHotspots: ImpactSourceHotspot[];
			componentHotspots: ImpactSourceHotspot[];
		},
	): void {
		writeFileSync(
			join(dataFolder, "hotspots.json"),
			JSON.stringify(
				{
					title: "Planetnik Hotspots",
					timestamp: new Date().toISOString(),
					fileHotspots: hotspotData.fileHotspots,
					unitHotspots: hotspotData.unitHotspots,
					componentHotspots: hotspotData.componentHotspots,
				},
				null,
				2,
			),
			"utf-8",
		);
	}

	private exportImpact(
		dataFolder: string,
		hotspotData: {
			fileHotspots: ImpactSourceHotspot[];
			unitHotspots: ImpactSourceHotspot[];
			componentHotspots: ImpactSourceHotspot[];
		},
	): void {
		const timestamp = new Date().toISOString();
		const impactExport = ImpactExporter.exportImpact(
			this.analysisResults,
			hotspotData,
			timestamp,
		);
		writeFileSync(
			join(dataFolder, "impact.json"),
			JSON.stringify(impactExport, null, 2),
			"utf-8",
		);
	}

	private exportContributorImpact(
		dataFolder: string,
		hotspotData: {
			fileHotspots: ImpactSourceHotspot[];
			unitHotspots: ImpactSourceHotspot[];
			componentHotspots: ImpactSourceHotspot[];
		},
	): void {
		const timestamp = new Date().toISOString();
		const contributorImpactExport =
			ContributorImpactExporter.exportContributorImpact(
				this.analysisResults,
				hotspotData,
				timestamp,
			);
		writeFileSync(
			join(dataFolder, "contributor_impact.json"),
			JSON.stringify(contributorImpactExport, null, 2),
			"utf-8",
		);
	}

	private buildHotspotData(): {
		fileHotspots: ImpactSourceHotspot[];
		unitHotspots: ImpactSourceHotspot[];
		componentHotspots: ImpactSourceHotspot[];
	} {
		const sourceFiles = this.getAllSourceFiles();
		const units = this.analysisResults.unitsAnalysisResults.allUnits;
		const duplicationPaths = this.getDuplicatedPaths();
		const temporalLinkCounts = this.getTemporalLinkCounts();
		const unitsByFile = new Map<string, UnitInfo[]>();

		for (const unit of units) {
			const relativePath = unit.sourceFile?.relativePath;
			if (!relativePath) continue;
			const existing = unitsByFile.get(relativePath) ?? [];
			existing.push(unit);
			unitsByFile.set(relativePath, existing);
		}

		const fileHotspots = sourceFiles
			.map((file) =>
				this.buildFileHotspot(
					file,
					unitsByFile.get(file.relativePath) ?? [],
					duplicationPaths,
					temporalLinkCounts,
				),
			)
			.sort((a, b) => b.score - a.score);

		const unitHotspots = units
			.filter((unit) => unit.sourceFile)
			.map((unit) => this.buildUnitHotspot(unit, temporalLinkCounts))
			.sort((a, b) => b.score - a.score);

		const componentHotspots =
			this.analysisResults.logicalDecompositionsAnalysisResults
				.flatMap((results) =>
					results.components.map((component) =>
						this.buildComponentHotspot(
							results.key,
							component.name,
							component.aspect?.sourceFiles ?? [],
							results.componentDependencies,
							temporalLinkCounts,
						),
					),
				)
				.sort((a, b) => b.score - a.score);

		return {
			fileHotspots,
			unitHotspots,
			componentHotspots,
		};
	}

	private exportContributors(dataFolder: string): void {
		const contributors =
			this.analysisResults.contributorsAnalysisResults.contributors;
		if (contributors.length === 0) return;

		const total = contributors.reduce(
			(sum: number, c: Contributor) => sum + c.commitsCount,
			0,
		);
		const contributorExport = contributors.map((c) => ({
			email: c.email,
			userName: c.userName,
			commitsCount: c.commitsCount,
			commitsCount30Days: c.commitsCount30Days,
			commitsCount90Days: c.commitsCount90Days,
			commitsCount180Days: c.commitsCount180Days,
			commitsCount365Days: c.commitsCount365Days,
			firstCommitDate: c.firstCommitDate,
			latestCommitDate: c.latestCommitDate,
			isBot: c.isBot,
		}));
		const lines: string[] = [];
		lines.push(
			"Contributor\t#commits (all time)\t#commits (30 days)\t#commits (90 days)\t#commits (180 days)\t#commits (365 days)\tfirst commit\tlast commit\tpercentage\tuserName\tisRookie\tisActive",
		);

		for (const c of contributors) {
			const percentage =
				total > 0
					? FormattingUtils.getFormattedPercentage(
							(100.0 * c.commitsCount) / total,
						)
					: "0%";
			lines.push(
				`${c.email}\t${c.commitsCount}\t${c.commitsCount30Days}\t${c.commitsCount90Days}\t${c.commitsCount180Days}\t${c.commitsCount365Days}\t${c.firstCommitDate}\t${c.latestCommitDate}\t${percentage}\t${c.userName}\t${c.isRookie()}\t${c.isActive()}`,
			);
		}

		writeFileSync(
			join(dataFolder, "contributors.json"),
			JSON.stringify(
				{
					title: "Contributors",
					timestamp: new Date().toISOString(),
					contributorCount: contributorExport.length,
					contributors: contributorExport,
				},
				null,
				2,
			),
			"utf-8",
		);
		writeFileSync(
			join(dataFolder, "contributors.txt"),
			lines.join("\n"),
			"utf-8",
		);
	}

	private exportContributorDetails(dataFolder: string): void {
		const contributors =
			this.analysisResults.contributorsAnalysisResults.contributors;
		if (contributors.length === 0) return;

		const detailsFolder = join(dataFolder, "contributor_details");
		if (!existsSync(detailsFolder)) {
			mkdirSync(detailsFolder, { recursive: true });
		}

		const sourceFiles = this.getAllSourceFiles();
		const collaboratorMap = this.getCollaboratorsByContributor();

		for (const contributor of contributors) {
			const exportInfo = this.buildContributorDetailExport(
				contributor,
				sourceFiles,
				collaboratorMap.get(contributor.email) ?? [],
			);
			const fileName = `${encodeURIComponent(contributor.email)}.json`;
			writeFileSync(
				join(detailsFolder, fileName),
				JSON.stringify(exportInfo, null, 2),
				"utf-8",
			);
		}
	}

	private exportJson(dataFolder: string): void {
		const mainAspect = this.analysisResults.mainAspectAnalysisResults;
		const testAspect = this.analysisResults.testAspectAnalysisResults;
		const generatedAspect = this.analysisResults.generatedAspectAnalysisResults;
		const buildAndDeployAspect =
			this.analysisResults.buildAndDeployAspectAnalysisResults;
		const otherAspect = this.analysisResults.otherAspectAnalysisResults;
		const history = this.analysisResults.filesHistoryAnalysisResults;
		const contributors =
			this.analysisResults.contributorsAnalysisResults.contributors.map(
				(contributor) => ({
					email: contributor.email,
					userName: contributor.userName,
					commitsCount: contributor.commitsCount,
					commitsCount30Days: contributor.commitsCount30Days,
					commitsCount90Days: contributor.commitsCount90Days,
					commitsCount180Days: contributor.commitsCount180Days,
					commitsCount365Days: contributor.commitsCount365Days,
					firstCommitDate: contributor.firstCommitDate,
					latestCommitDate: contributor.latestCommitDate,
					isBot: contributor.isBot,
				}),
			);
		const mapAspectSummary = (aspect: {
			linesOfCode: number;
			filesCount: number;
			linesOfCodePerExtension: Array<{ name: string; value: number }>;
		}) => ({
			linesOfCode: aspect.linesOfCode,
			filesCount: aspect.filesCount,
			linesOfCodePerExtension: aspect.linesOfCodePerExtension.map((metric) => ({
				extension: metric.name.replace(/^[.]/, ""),
				linesOfCode: metric.value,
			})),
		});
		const duplicationPercentage =
			this.analysisResults.duplicationAnalysisResults.overallDuplication.getDuplicationPercentage();
		const summary = {
			metadata: this.analysisResults.codeConfiguration?.metadata,
			filesCount: mainAspect.filesCount,
			linesOfCode: mainAspect.linesOfCode,
			extensions: mapAspectSummary(mainAspect).linesOfCodePerExtension.map(
				(entry) => entry.extension,
			),
			mainAspectAnalysisResults: mapAspectSummary(mainAspect),
			testAspectAnalysisResults: mapAspectSummary(testAspect),
			generatedAspectAnalysisResults: mapAspectSummary(generatedAspect),
			buildAndDeployAspectAnalysisResults:
				mapAspectSummary(buildAndDeployAspect),
			otherAspectAnalysisResults: mapAspectSummary(otherAspect),
			contributorsAnalysisResults: {
				latestCommitDate:
					this.analysisResults.contributorsAnalysisResults.latestCommitDate,
				contributors,
			},
			filesHistoryAnalysisResults: {
				firstDate: history.firstDate,
				latestDate: history.latestDate,
			},
			duplicationAnalysisResults: {
				overallDuplication: duplicationPercentage,
			},
			duplication: {
				percentage: duplicationPercentage,
				duplicatedLines:
					this.analysisResults.duplicationAnalysisResults.overallDuplication
						.duplicatedLinesOfCode,
				cleanedLines:
					this.analysisResults.duplicationAnalysisResults.overallDuplication
						.cleanedLinesOfCode,
			},
		};
		writeFileSync(
			join(dataFolder, "analysisResults.json"),
			JSON.stringify(summary, null, 2),
			"utf-8",
		);
	}

	private exportDuplicates(dataFolder: string): void {
		const timestamp = new Date().toISOString();

		this.exportDuplicatesList(
			this.analysisResults.duplicationAnalysisResults.allDuplicates,
			"duplicates",
			dataFolder,
			timestamp,
		);
		this.exportDuplicatesList(
			this.analysisResults.duplicationAnalysisResults.unitDuplicates,
			"unit_duplicates",
			dataFolder,
			timestamp,
		);
	}

	private exportDuplicatesList(
		instances: DuplicationInstance[],
		fileName: string,
		dataFolder: string,
		timestamp: string,
	): void {
		if (instances.length === 0) return;

		const limited =
			instances.length > DataExporter.MAX_EXPORT_LIST_SIZE
				? instances.slice(0, DataExporter.MAX_EXPORT_LIST_SIZE)
				: instances;
		const exportInfo = DuplicationExporter.exportDuplication(
			limited,
			"Duplication",
			timestamp,
		);
		writeFileSync(
			join(dataFolder, `${fileName}.json`),
			JSON.stringify(
				{
					...exportInfo,
					totalDuplicatesCount: instances.length,
					truncated: instances.length > limited.length,
				},
				null,
				2,
			),
			"utf-8",
		);

		// Text format
		const lines: string[] = [];
		let id = 1;
		for (const dup of limited) {
			lines.push(`duplicated block id: ${id}`);
			lines.push(`size: ${dup.blockSize} cleaned lines of code`);
			lines.push(`in ${dup.duplicatedFileBlocks.length} files:`);
			for (const block of dup.duplicatedFileBlocks) {
				lines.push(
					` - ${block.sourceFile?.relativePath ?? ""} (${block.startLine}:${block.endLine})`,
				);
			}
			lines.push("");
			id++;
		}
		writeFileSync(
			join(dataFolder, `${fileName}.txt`),
			lines.join("\n"),
			"utf-8",
		);
	}

	private exportUnits(dataFolder: string): void {
		const timestamp = new Date().toISOString();
		const srcRoot = this.analysisResults.codeConfiguration?.srcRoot ?? "";
		const units = this.analysisResults.unitsAnalysisResults.allUnits;

		if (units.length > 0) {
			const unitExport = UnitListExporter.exportUnits(
				units,
				"All Units",
				srcRoot,
				timestamp,
			);
			writeFileSync(
				join(dataFolder, "units.json"),
				JSON.stringify(unitExport, null, 2),
				"utf-8",
			);
		}

		// Text format
		const lines: string[] = [];
		let id = 1;
		for (const u of units) {
			lines.push(`id: ${id}`);
			lines.push(`unit: ${u.shortName}`);
			lines.push(`file: ${u.sourceFile?.relativePath ?? ""}`);
			lines.push(`start line: ${u.startLine}`);
			lines.push(`end line: ${u.endLine}`);
			lines.push(`size: ${u.linesOfCode} LOC`);
			lines.push(`McCabe index: ${u.mcCabeIndex}`);
			lines.push(`number of parameters: ${u.numberOfParameters}`);
			lines.push("");
			id++;
		}
		writeFileSync(join(dataFolder, "units.txt"), lines.join("\n"), "utf-8");
	}

	private exportDependencies(dataFolder: string): void {
		const timestamp = new Date().toISOString();

		// Export all dependencies
		if (this.analysisResults.allDependencies.length > 0) {
			const depExport = DependenciesExporter.exportDependencies(
				this.analysisResults.allDependencies,
				"Dependencies",
				timestamp,
			);
			writeFileSync(
				join(dataFolder, "dependencies.json"),
				JSON.stringify(depExport, null, 2),
				"utf-8",
			);
		}

		const componentDependencies =
			this.analysisResults.logicalDecompositionsAnalysisResults.flatMap(
				(decomposition) =>
					decomposition.componentDependencies.map((dependency) => ({
						decompositionKey: decomposition.key,
						dependency,
					})),
			);

		if (componentDependencies.length > 0) {
			const componentDependencyExport =
				ComponentDependenciesExporter.exportDependencies(
					componentDependencies,
					"Static Component Dependencies",
					timestamp,
				);
			writeFileSync(
				join(dataFolder, "component_dependencies.json"),
				JSON.stringify(componentDependencyExport, null, 2),
				"utf-8",
			);
		}

		// Export per-logical-decomposition component dependencies
		for (const decomposition of this.analysisResults
			.logicalDecompositionsAnalysisResults) {
			const name = decomposition.key;
			const deps = decomposition.componentDependencies;
			if (deps.length === 0) continue;

			// All dependencies for this decomposition
			this.exportComponentDependencies(deps, "", "", name, dataFolder);

			// Per-component-pair dependencies
			for (const dep of deps) {
				this.exportComponentDependencies(
					deps,
					dep.fromComponent,
					dep.toComponent,
					name,
					dataFolder,
				);
			}
		}
	}

	private exportComponentDependencies(
		dependencies: ComponentDependency[],
		filterFrom: string,
		filterTo: string,
		decompositionName: string,
		dataFolder: string,
	): void {
		const lines: string[] = [];
		const safeDecomp = decompositionName.replace(/[^a-zA-Z0-9._-]/g, "_");
		let fileNamePrefix = `dependencies_${safeDecomp}`;
		if (filterFrom && filterTo) {
			const safeFrom = filterFrom.replace(/[^a-zA-Z0-9._-]/g, "_");
			const safeTo = filterTo.replace(/[^a-zA-Z0-9._-]/g, "_");
			fileNamePrefix += `_${safeFrom}_${safeTo}`;
		}

		for (const dep of dependencies) {
			if (filterFrom && filterTo) {
				if (
					dep.fromComponent.toLowerCase() !== filterFrom.toLowerCase() ||
					dep.toComponent.toLowerCase() !== filterTo.toLowerCase()
				)
					continue;
			}
			for (const evidence of dep.evidence) {
				lines.push(`from: ${dep.fromComponent}`);
				lines.push(`to: ${dep.toComponent}`);
				lines.push("evidence:");
				lines.push(` - file: "${evidence.pathFrom}"`);
				lines.push(`   contains "${evidence.evidence}"`);
				lines.push("");
			}
		}

		writeFileSync(
			join(dataFolder, `${fileNamePrefix}.txt`),
			lines.join("\n"),
			"utf-8",
		);
	}

	private exportTemporalDependencies(dataFolder: string): void {
		const historyResults = this.analysisResults.filesHistoryAnalysisResults;
		const maxDays =
			this.analysisResults.codeConfiguration?.analysis
				.maxTemporalDependenciesDepthDays ?? 0;
		const periods = [
			{
				key: "30_days",
				label: "Past 30 Days",
				days: 30,
				fileName: "temporal_dependencies_30_days.txt",
				pairs: historyResults.filePairsChangedTogether30Days,
				enabled: maxDays >= 30,
			},
			{
				key: "90_days",
				label: "Past 3 Months",
				days: 90,
				fileName: "temporal_dependencies_90_days.txt",
				pairs: historyResults.filePairsChangedTogether90Days,
				enabled: maxDays >= 90,
			},
			{
				key: "180_days",
				label: "Past 6 Months",
				days: 180,
				fileName: "temporal_dependencies_180_days.txt",
				pairs: historyResults.filePairsChangedTogether180Days,
				enabled: maxDays >= 180,
			},
			{
				key: "all_time",
				label: `Past ${maxDays} Days`,
				days: maxDays,
				fileName: "temporal_dependencies.txt",
				pairs: historyResults.filePairsChangedTogether,
				enabled: maxDays > 180,
			},
		].filter((period) => period.enabled);

		for (const period of periods) {
			this.exportFilePairsChangedTogether(
				period.pairs,
				period.fileName,
				dataFolder,
			);
		}

		if (periods.length > 0) {
			const temporalDependenciesExport =
				TemporalDependenciesExporter.exportDependencies(
					periods,
					"Temporal Dependencies",
					new Date().toISOString(),
				);
			writeFileSync(
				join(dataFolder, "temporal_dependencies.json"),
				JSON.stringify(temporalDependenciesExport, null, 2),
				"utf-8",
			);
		}
	}

	private exportFilePairsChangedTogether(
		pairs: Array<{
			sourceFile1Path: string;
			sourceFile2Path: string;
			commitsCountFile1: number;
			commitsCountFile2: number;
			commits: string[];
		}>,
		fileName: string,
		dataFolder: string,
	): void {
		const lines: string[] = [];
		lines.push(
			"file 1\tfile 2\t# same commits\t# commits file 1\t# commits file 2",
		);

		const sorted = [...pairs].sort(
			(a, b) => b.commits.length - a.commits.length,
		);
		const limited = sorted.slice(0, DataExporter.MAX_EXPORT_LIST_SIZE);

		for (const pair of limited) {
			lines.push(
				`${pair.sourceFile1Path}\t${pair.sourceFile2Path}\t${pair.commits.length}\t${pair.commitsCountFile1}\t${pair.commitsCountFile2}`,
			);
		}

		writeFileSync(join(dataFolder, fileName), lines.join("\n"), "utf-8");
	}

	private exportPeopleDependencies(dataFolder: string): void {
		const contribResults = this.analysisResults.contributorsAnalysisResults;

		const exportDeps = (deps: ComponentDependency[], fileName: string) => {
			if (deps.length === 0) return;
			const limited = deps.slice(0, DataExporter.MAX_EXPORT_LIST_SIZE);
			const exported = limited.map((d) => ({
				from: d.fromComponent,
				to: d.toComponent,
				count: d.count,
				files: d.data,
			}));
			writeFileSync(
				join(dataFolder, fileName),
				JSON.stringify(exported, null, 2),
				"utf-8",
			);
		};

		exportDeps(
			contribResults.peopleDependencies30Days,
			"people_dependencies_30d.json",
		);
		exportDeps(
			contribResults.peopleDependencies90Days,
			"people_dependencies_90d.json",
		);
		exportDeps(
			contribResults.peopleDependencies180Days,
			"people_dependencies_180d.json",
		);
		exportDeps(
			contribResults.peopleDependencies365Days,
			"people_dependencies_365d.json",
		);
		exportDeps(
			contribResults.peopleDependenciesAllTime,
			"people_dependencies.json",
		);
	}

	private exportCommitsPerExtension(dataFolder: string): void {
		const commitsPerExtension =
			this.analysisResults.contributorsAnalysisResults.commitsPerExtension;
		if (commitsPerExtension.length === 0) return;

		const exported = commitsPerExtension.map((cpe) => ({
			extension: cpe.extension,
			commitsCount: cpe.commitsCount,
			committersCount: cpe.committers.length,
			filesCount: cpe.filesCount,
			commitsCount30Days: cpe.commitsCount30Days,
			committersCount30Days: cpe.committers30Days.length,
			filesCount30Days: cpe.filesCount30Days,
			commitsCount90Days: cpe.commitsCount90Days,
			committersCount90Days: cpe.committers90Days.length,
			filesCount90Days: cpe.filesCount90Days,
		}));

		writeFileSync(
			join(dataFolder, "commits_per_extension.json"),
			JSON.stringify(exported, null, 2),
			"utf-8",
		);
	}

	private exportContributorTimeline(dataFolder: string): void {
		const contribResults = this.analysisResults.contributorsAnalysisResults;

		const exportSlots = (
			slots: Array<{
				timeSlot: string;
				contributorsCount: number;
				commitsCount: number;
			}>,
		) =>
			slots
				.filter((s) => s.commitsCount > 0)
				.map((s) => ({
					timeSlot: s.timeSlot,
					contributors: s.contributorsCount,
					commits: s.commitsCount,
				}));

		const perYear = exportSlots(contribResults.contributorsPerYear);
		const perMonth = exportSlots(contribResults.contributorsPerMonth);

		if (perYear.length === 0 && perMonth.length === 0) return;

		const timeline = { perYear, perMonth };
		writeFileSync(
			join(dataFolder, "contributor_timeline.json"),
			JSON.stringify(timeline, null, 2),
			"utf-8",
		);
	}

	private buildContributorDetailExport(
		contributor: Contributor,
		sourceFiles: SourceFile[],
		collaborators: Array<{ email: string; sharedFiles: number }>,
	) {
		const dailyActivity = new Map<string, number>();
		const seenCommitIds = new Set<string>();
		const extensionStats = new Map<
			string,
			{ commitIds: Set<string>; files: Set<string> }
		>();
		const logicalComponentStats = new Map<
			string,
			{ files: Set<string>; linesOfCode: number }
		>();
		const concernStats = new Map<
			string,
			{ files: Set<string>; linesOfCode: number }
		>();

		const files = sourceFiles
			.map((file) => {
				const commits = file.fileModificationHistory?.commits ?? [];
				const matchingCommits = commits.filter(
					(commit) => commit.email === contributor.email,
				);
				if (matchingCommits.length === 0) return null;

				const fileCommitIds = new Set<string>();

				for (const [index, commit] of matchingCommits.entries()) {
					const commitId = this.getContributorCommitId(
						commit.id,
						commit.date,
						file.relativePath,
						index,
					);
					fileCommitIds.add(commitId);

					if (!seenCommitIds.has(commitId)) {
						seenCommitIds.add(commitId);
						dailyActivity.set(
							commit.date,
							(dailyActivity.get(commit.date) ?? 0) + 1,
						);
					}

					const extensionKey = file.extension || "";
					const extension = extensionStats.get(extensionKey) ?? {
						commitIds: new Set<string>(),
						files: new Set<string>(),
					};
					extension.commitIds.add(commitId);
					extension.files.add(file.relativePath);
					extensionStats.set(extensionKey, extension);
				}

				for (const component of file.logicalComponents) {
					this.addFootprintEntry(
						logicalComponentStats,
						component.name,
						file.relativePath,
						file.linesOfCode,
					);
				}
				for (const concern of file.concerns) {
					this.addFootprintEntry(
						concernStats,
						concern.name,
						file.relativePath,
						file.linesOfCode,
					);
				}

				return {
					relativePath: file.relativePath,
					extension: file.extension,
					commits: fileCommitIds.size,
					logicalComponents: file.logicalComponents
						.map((component) => component.name)
						.sort(),
					concerns: file.concerns.map((concern) => concern.name).sort(),
				};
			})
			.filter((file): file is NonNullable<typeof file> => file !== null)
			.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

		return {
			email: contributor.email,
			userName: contributor.userName,
			commitsCount: contributor.commitsCount,
			commitsCount30Days: contributor.commitsCount30Days,
			commitsCount90Days: contributor.commitsCount90Days,
			commitsCount180Days: contributor.commitsCount180Days,
			commitsCount365Days: contributor.commitsCount365Days,
			firstCommitDate: contributor.firstCommitDate,
			latestCommitDate: contributor.latestCommitDate,
			isActive: contributor.isActive(),
			isRookie: contributor.isRookie(),
			dailyActivity: Array.from(dailyActivity.entries())
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([date, commits]) => ({ date, commits })),
			files,
			extensions: Array.from(extensionStats.entries())
				.map(([extension, stats]) => ({
					extension,
					commits: stats.commitIds.size,
					files: stats.files.size,
				}))
				.sort((a, b) => a.extension.localeCompare(b.extension)),
			logicalComponents: this.getSortedFootprint(logicalComponentStats),
			concerns: this.getSortedFootprint(concernStats),
			collaborators,
		};
	}

	private getAllSourceFiles(): SourceFile[] {
		const config = this.analysisResults.codeConfiguration;
		if (!config) return [];

		const files = [
			...config.main.sourceFiles,
			...config.test.sourceFiles,
			...config.generated.sourceFiles,
			...config.buildAndDeployment.sourceFiles,
			...config.other.sourceFiles,
		] as SourceFile[];

		const uniqueFiles = new Map<string, SourceFile>();
		for (const file of files) {
			uniqueFiles.set(file.relativePath, file);
		}
		return Array.from(uniqueFiles.values());
	}

	private getCollaboratorsByContributor(): Map<
		string,
		Array<{ email: string; sharedFiles: number }>
	> {
		const collaborators = new Map<
			string,
			Array<{ email: string; sharedFiles: number }>
		>();

		const addCollaborator = (
			contributorEmail: string,
			collaboratorEmail: string,
			sharedFiles: number,
		) => {
			const entries = collaborators.get(contributorEmail) ?? [];
			entries.push({ email: collaboratorEmail, sharedFiles });
			collaborators.set(contributorEmail, entries);
		};

		for (const dependency of this.analysisResults.contributorsAnalysisResults
			.peopleDependenciesAllTime) {
			addCollaborator(
				dependency.fromComponent,
				dependency.toComponent,
				dependency.count,
			);
			addCollaborator(
				dependency.toComponent,
				dependency.fromComponent,
				dependency.count,
			);
		}

		for (const [email, entries] of collaborators.entries()) {
			entries.sort(
				(a, b) =>
					b.sharedFiles - a.sharedFiles || a.email.localeCompare(b.email),
			);
			collaborators.set(email, entries);
		}

		return collaborators;
	}

	private addFootprintEntry(
		footprint: Map<string, { files: Set<string>; linesOfCode: number }>,
		name: string,
		filePath: string,
		linesOfCode: number,
	): void {
		if (!name) return;
		const entry = footprint.get(name) ?? {
			files: new Set<string>(),
			linesOfCode: 0,
		};
		if (!entry.files.has(filePath)) {
			entry.files.add(filePath);
			entry.linesOfCode += linesOfCode;
		}
		footprint.set(name, entry);
	}

	private getSortedFootprint(
		footprint: Map<string, { files: Set<string>; linesOfCode: number }>,
	) {
		return Array.from(footprint.entries())
			.map(([name, info]) => ({
				name,
				files: info.files.size,
				linesOfCode: info.linesOfCode,
			}))
			.sort((a, b) => a.name.localeCompare(b.name));
	}

	private getContributorCommitId(
		commitId: string,
		date: string,
		filePath: string,
		index: number,
	): string {
		if (commitId) return commitId;
		return `${filePath}:${date}:${index}`;
	}

	private getDuplicatedPaths(): Set<string> {
		const duplicatedPaths = new Set<string>();
		const instances = [
			...this.analysisResults.duplicationAnalysisResults.allDuplicates,
			...this.analysisResults.duplicationAnalysisResults.unitDuplicates,
		];

		for (const instance of instances) {
			for (const block of instance.duplicatedFileBlocks) {
				if (block.sourceFile?.relativePath) {
					duplicatedPaths.add(block.sourceFile.relativePath);
				}
			}
		}

		return duplicatedPaths;
	}

	private getTemporalLinkCounts(): Map<string, number> {
		const history = this.analysisResults.filesHistoryAnalysisResults;
		const preferredPairs =
			history.filePairsChangedTogether180Days.length > 0
				? history.filePairsChangedTogether180Days
				: history.filePairsChangedTogether90Days.length > 0
					? history.filePairsChangedTogether90Days
					: history.filePairsChangedTogether30Days.length > 0
						? history.filePairsChangedTogether30Days
						: history.filePairsChangedTogether;

		const counts = new Map<string, number>();
		for (const pair of preferredPairs) {
			counts.set(
				pair.sourceFile1Path,
				(counts.get(pair.sourceFile1Path) ?? 0) + 1,
			);
			counts.set(
				pair.sourceFile2Path,
				(counts.get(pair.sourceFile2Path) ?? 0) + 1,
			);
		}
		return counts;
	}

	private buildFileHotspot(
		file: SourceFile,
		units: UnitInfo[],
		duplicationPaths: Set<string>,
		temporalLinkCounts: Map<string, number>,
	): ImpactSourceHotspot {
		const commitsCount = file.fileModificationHistory?.dates.length ?? 0;
		const contributorsCount =
			file.fileModificationHistory?.countContributors() ?? 0;
		const temporalLinks = temporalLinkCounts.get(file.relativePath) ?? 0;
		const maxComplexity = units.reduce(
			(max, unit) => Math.max(max, unit.mcCabeIndex),
			0,
		);
		const duplicated = duplicationPaths.has(file.relativePath);
		const reasons: string[] = [];
		if (file.linesOfCode >= 500)
			reasons.push(`large file (${file.linesOfCode} LOC)`);
		if (commitsCount >= 12)
			reasons.push(`high churn (${commitsCount} commits)`);
		if (temporalLinks >= 4)
			reasons.push(`high temporal coupling (${temporalLinks} linked files)`);
		if (maxComplexity >= 10)
			reasons.push(`complex units inside file (max McCabe ${maxComplexity})`);

		if (contributorsCount <= 1 && commitsCount > 0) {
			reasons.push("single-contributor knowledge concentration");
		} else if (contributorsCount === 2) {
			reasons.push("low backup ownership");
		}

		if (duplicated) {
			reasons.push("duplicate code present");
		}

		const dimensions = this.buildRiskDimensions({
			structuralRisk:
				this.scaledScore(file.linesOfCode, 800, 45) +
				this.scaledScore(maxComplexity, 20, 35) +
				(duplicated ? 20 : 0),
			changePressure: this.scaledScore(commitsCount, 25, 70),
			coordinationCost:
				this.scaledScore(temporalLinks, 8, 70) +
				this.scaledScore(Math.max(contributorsCount - 1, 0), 4, 15),
			knowledgeRisk:
				this.knowledgeRiskScore(contributorsCount, commitsCount) +
				this.scaledScore(temporalLinks, 8, 10),
		});

		return {
			id: `file:${file.relativePath}`,
			kind: "file",
			name: file.relativePath,
			parent: file.logicalComponents[0]?.name ?? "",
			route: "/files/churn",
			score: dimensions.score,
			severity: this.getSeverity(dimensions.score),
			size: file.linesOfCode,
			commitsCount,
			contributorsCount,
			temporalLinks,
			complexity: maxComplexity,
			dimensions: dimensions.scores,
			dominantDimension: dimensions.dominantDimension,
			suggestedAction: this.getSuggestedAction(
				"file",
				dimensions.dominantDimension,
			),
			reasons,
		};
	}

	private buildUnitHotspot(
		unit: UnitInfo,
		temporalLinkCounts: Map<string, number>,
	): ImpactSourceHotspot {
		const file = unit.sourceFile;
		const filePath = file?.relativePath ?? "";
		const fileCommits = file?.fileModificationHistory?.dates.length ?? 0;
		const fileContributors =
			file?.fileModificationHistory?.countContributors() ?? 0;
		const temporalLinks = filePath
			? (temporalLinkCounts.get(filePath) ?? 0)
			: 0;
		const reasons: string[] = [];
		if (unit.linesOfCode >= 40)
			reasons.push(`large unit (${unit.linesOfCode} LOC)`);
		if (unit.mcCabeIndex >= 10)
			reasons.push(`high conditional complexity (${unit.mcCabeIndex})`);
		if (unit.numberOfParameters >= 4)
			reasons.push(`many parameters (${unit.numberOfParameters})`);
		if (fileCommits >= 12)
			reasons.push(`lives in a high-churn file (${fileCommits} commits)`);
		if (temporalLinks >= 4)
			reasons.push(`file is temporally coupled (${temporalLinks} links)`);

		if (fileContributors <= 1 && fileCommits > 0) {
			reasons.push("narrow ownership around parent file");
		}

		const dimensions = this.buildRiskDimensions({
			structuralRisk:
				this.scaledScore(unit.linesOfCode, 80, 30) +
				this.scaledScore(unit.mcCabeIndex, 20, 50) +
				this.scaledScore(unit.numberOfParameters, 6, 20),
			changePressure: this.scaledScore(fileCommits, 25, 75),
			coordinationCost:
				this.scaledScore(temporalLinks, 8, 75) +
				this.scaledScore(Math.max(fileContributors - 1, 0), 4, 10),
			knowledgeRisk:
				this.knowledgeRiskScore(fileContributors, fileCommits) +
				this.scaledScore(unit.mcCabeIndex, 20, 10),
		});

		return {
			id: `unit:${filePath}:${unit.startLine}`,
			kind: "unit",
			name: unit.shortName,
			parent: filePath,
			route: "/units/complexity",
			score: dimensions.score,
			severity: this.getSeverity(dimensions.score),
			size: unit.linesOfCode,
			commitsCount: fileCommits,
			contributorsCount: fileContributors,
			temporalLinks,
			complexity: unit.mcCabeIndex,
			dimensions: dimensions.scores,
			dominantDimension: dimensions.dominantDimension,
			suggestedAction: this.getSuggestedAction(
				"unit",
				dimensions.dominantDimension,
			),
			reasons,
		};
	}

	private buildComponentHotspot(
		decompositionKey: string,
		componentName: string,
		sourceFiles: SourceFile[],
		dependencies: ComponentDependency[],
		temporalLinkCounts: Map<string, number>,
	): ImpactSourceHotspot {
		const loc = sourceFiles.reduce((sum, file) => sum + file.linesOfCode, 0);
		const commitsCount = sourceFiles.reduce(
			(sum, file) => sum + (file.fileModificationHistory?.dates.length ?? 0),
			0,
		);
		const contributors = new Set<string>();
		let temporalLinks = 0;

		for (const file of sourceFiles) {
			for (const commit of file.fileModificationHistory?.commits ?? []) {
				if (commit.email) contributors.add(commit.email);
			}
			temporalLinks += temporalLinkCounts.get(file.relativePath) ?? 0;
		}

		const outgoingDeps = dependencies.filter(
			(dependency) => dependency.fromComponent === componentName,
		).length;
		const incomingDeps = dependencies.filter(
			(dependency) => dependency.toComponent === componentName,
		).length;
		const reasons: string[] = [];
		if (loc >= 2500) reasons.push(`large component footprint (${loc} LOC)`);
		if (sourceFiles.length >= 12)
			reasons.push(`many files (${sourceFiles.length})`);
		if (commitsCount >= 30)
			reasons.push(`high accumulated churn (${commitsCount} commits)`);
		if (temporalLinks >= 10)
			reasons.push(
				`strong co-change pressure (${temporalLinks} temporal links)`,
			);
		if (incomingDeps + outgoingDeps >= 4)
			reasons.push(
				`high dependency centrality (${incomingDeps + outgoingDeps} edges)`,
			);

		if (contributors.size <= 1 && commitsCount > 0) {
			reasons.push("single-contributor component knowledge");
		} else if (contributors.size === 2) {
			reasons.push("low contributor backup");
		}

		const dimensions = this.buildRiskDimensions({
			structuralRisk:
				this.scaledScore(loc, 5000, 45) +
				this.scaledScore(sourceFiles.length, 25, 25),
			changePressure: this.scaledScore(commitsCount, 80, 70),
			coordinationCost:
				this.scaledScore(temporalLinks, 25, 45) +
				this.scaledScore(incomingDeps + outgoingDeps, 8, 45) +
				this.scaledScore(Math.max(contributors.size - 1, 0), 8, 10),
			knowledgeRisk:
				this.knowledgeRiskScore(contributors.size, commitsCount) +
				this.scaledScore(incomingDeps + outgoingDeps, 8, 10),
		});

		return {
			id: `component:${decompositionKey}:${componentName}`,
			kind: "component",
			name: componentName,
			parent: decompositionKey,
			route: "/components",
			score: dimensions.score,
			severity: this.getSeverity(dimensions.score),
			size: loc,
			commitsCount,
			contributorsCount: contributors.size,
			temporalLinks,
			complexity: incomingDeps + outgoingDeps,
			dimensions: dimensions.scores,
			dominantDimension: dimensions.dominantDimension,
			suggestedAction: this.getSuggestedAction(
				"component",
				dimensions.dominantDimension,
			),
			reasons,
		};
	}

	private buildRiskDimensions(scores: {
		structuralRisk: number;
		changePressure: number;
		coordinationCost: number;
		knowledgeRisk: number;
	}) {
		const normalizedScores = {
			structuralRisk: this.capDimension(scores.structuralRisk),
			changePressure: this.capDimension(scores.changePressure),
			coordinationCost: this.capDimension(scores.coordinationCost),
			knowledgeRisk: this.capDimension(scores.knowledgeRisk),
		};
		const dominantDimension = this.getDominantDimension(normalizedScores);
		const weightedScore =
			normalizedScores.structuralRisk * 0.3 +
			normalizedScores.changePressure * 0.3 +
			normalizedScores.coordinationCost * 0.2 +
			normalizedScores.knowledgeRisk * 0.2;

		return {
			score: this.roundScore(weightedScore),
			scores: normalizedScores,
			dominantDimension,
		};
	}

	private capDimension(score: number): number {
		return this.roundScore(Math.min(Math.max(score, 0), 100));
	}

	private getDominantDimension(scores: {
		structuralRisk: number;
		changePressure: number;
		coordinationCost: number;
		knowledgeRisk: number;
	}):
		| "structuralRisk"
		| "changePressure"
		| "coordinationCost"
		| "knowledgeRisk" {
		const entries = Object.entries(scores) as Array<
			[
				(
					| "structuralRisk"
					| "changePressure"
					| "coordinationCost"
					| "knowledgeRisk"
				),
				number,
			]
		>;
		entries.sort((a, b) => b[1] - a[1]);
		return entries[0]?.[0] ?? "structuralRisk";
	}

	private knowledgeRiskScore(
		contributorsCount: number,
		commitsCount: number,
	): number {
		if (commitsCount <= 0) return 0;
		if (contributorsCount <= 1) {
			return 85 + this.scaledScore(commitsCount, 25, 15);
		}
		if (contributorsCount === 2) {
			return 55 + this.scaledScore(commitsCount, 25, 10);
		}
		if (contributorsCount === 3) {
			return 25 + this.scaledScore(commitsCount, 25, 10);
		}
		return this.scaledScore(commitsCount, 25, 8);
	}

	private getSuggestedAction(
		kind: "file" | "unit" | "component",
		dominantDimension:
			| "structuralRisk"
			| "changePressure"
			| "coordinationCost"
			| "knowledgeRisk",
	): string {
		if (dominantDimension === "structuralRisk") {
			if (kind === "unit")
				return "Split or simplify this unit to reduce branching and parameter load.";
			if (kind === "component")
				return "Break the component into clearer seams and reduce oversized files.";
			return "Break this file down, remove duplication, and trim local complexity.";
		}

		if (dominantDimension === "changePressure") {
			if (kind === "component")
				return "Stabilize the component before adding more scope and review its change drivers.";
			return "Stabilize this hotspot before more features land and review why it changes so often.";
		}

		if (dominantDimension === "coordinationCost") {
			if (kind === "component")
				return "Reduce dependency edges and align component boundaries with change patterns.";
			return "Reduce co-change paths and cross-boundary edits around this hotspot.";
		}

		if (kind === "component") {
			return "Broaden ownership of this component and add backup maintainers.";
		}
		return "Broaden ownership and create a clear handover path for this hotspot.";
	}

	private extractFindings(findingsHtml: string | null): Array<{
		id: string;
		summary: string;
		bodyHtml: string;
		bodyText: string;
	}> {
		if (!findingsHtml || findingsHtml.trim().length === 0) return [];

		const findings: Array<{
			id: string;
			summary: string;
			bodyHtml: string;
			bodyText: string;
		}> = [];
		const findingRegex = /<finding>(.*?)<\/finding>/gs;
		let index = 0;

		for (
			let findingMatch = findingRegex.exec(findingsHtml);
			findingMatch !== null;
			findingMatch = findingRegex.exec(findingsHtml)
		) {
			index += 1;
			const findingContent = findingMatch[1] ?? "";
			const summaryMatch = /<summary>(.*?)<\/summary>/is.exec(findingContent);
			const bodyMatch = /<body>(.*?)<\/body>/is.exec(findingContent);
			const summary = summaryMatch?.[1]?.trim() || `Finding ${index}`;
			const bodyHtml = bodyMatch?.[1]?.trim() || findingContent.trim();
			findings.push({
				id: `finding-${index}`,
				summary,
				bodyHtml,
				bodyText: this.htmlToText(bodyHtml),
			});
		}

		if (findings.length === 0) {
			return [
				{
					id: "finding-1",
					summary: "Notes & Findings",
					bodyHtml: findingsHtml.trim(),
					bodyText: this.htmlToText(findingsHtml),
				},
			];
		}

		return findings;
	}

	private htmlToText(html: string): string {
		return html
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/p>/gi, "\n")
			.replace(/<[^>]+>/g, " ")
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/\s+/g, " ")
			.trim();
	}

	private scaledScore(
		value: number,
		threshold: number,
		weight: number,
	): number {
		if (value <= 0 || threshold <= 0 || weight <= 0) return 0;
		return Math.min(value / threshold, 1) * weight;
	}

	private getSeverity(score: number): string {
		if (score >= 75) return "Critical";
		if (score >= 55) return "High";
		if (score >= 35) return "Medium";
		return "Low";
	}

	private roundScore(score: number): number {
		return Math.round(score * 10) / 10;
	}

	static dependenciesFileNamePrefix(
		fromComponent: string,
		toComponent: string,
		logicalDecompositionName: string,
	): string {
		const safeName = logicalDecompositionName.replace(/[^a-zA-Z0-9._-]/g, "_");
		let prefix = `dependencies_${safeName}`;
		if (fromComponent && toComponent) {
			const safeFrom = fromComponent.replace(/[^a-zA-Z0-9._-]/g, "_");
			const safeTo = toComponent.replace(/[^a-zA-Z0-9._-]/g, "_");
			prefix += `_${safeFrom}_${safeTo}`;
		}
		return prefix;
	}
}
