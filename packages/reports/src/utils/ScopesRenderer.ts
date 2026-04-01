import type { NumericMetric } from "@planetnik/analyzer";
import { FormattingUtils } from "@planetnik/common";
import { SimpleOneBarChart } from "../charts/SimpleOneBarChart.js";
import type { RichTextReport } from "../core/RichTextReport.js";
import { ScopeRendererItem } from "./ScopeRendererItem.js";

export class ScopesRenderer {
	aspectsFileListPaths: string[] = [];
	fileCountPerComponent: NumericMetric[] = [];
	linesOfCode: NumericMetric[] = [];
	title = "";
	description = "";
	maxFileCount = 0;
	maxLinesOfCode = 0;
	filesCount = 0;
	linesCount = 0;
	linesOfCodeInMain = 1;
	totalNumberOfRegexMatches = 0;
	inSection = true;
	filesListPath = "";
	explorers = "";
	sort = true;
	metric = "LOC";
	describe = true;
	activeColor = "#00aced";

	renderReport(
		report: RichTextReport,
		description: string,
		extraIntroHtmlFragment?: string,
	): void {
		this.updateCountVariables();
		if (this.fileCountPerComponent.length === 0) return;
		if (this.linesOfCode.length === 0 || this.linesCount === 0) return;

		const renderingList = this.getRenderingList();
		if (this.inSection) {
			report.startSubSection(this.title, description);
			if (this.describe) {
				if (extraIntroHtmlFragment) {
					report.addHtmlContent(extraIntroHtmlFragment);
				}
				this.renderDetails(report, false);
				if (renderingList.length > 1) {
					report.startUnorderedList();
					const firstMetric = renderingList[0]!.linesOfCode;
					const firstPercentage = (100.0 * firstMetric.value) / this.linesCount;
					report.addListItem(
						`"${firstMetric.name}" is biggest, containing <b>${firstPercentage.toFixed(2)}%</b> of ${this.metric}.`,
					);
					if (renderingList.length >= 2) {
						const lastMetric =
							renderingList[renderingList.length - 1]!.linesOfCode;
						const lastPercentage = (100.0 * lastMetric.value) / this.linesCount;
						report.addListItem(
							`"${lastMetric.name}" is smallest, containing <b>${lastPercentage.toFixed(2)}%</b> of ${this.metric}.`,
						);
					}
					report.endUnorderedList();
				}
				report.addLineBreak();
				report.addLineBreak();
			}
		}

		report.startScrollingDiv();
		this.getSvgBars(report, renderingList);
		report.endDiv();

		if (this.inSection) report.endSection();
	}

	renderDetails(report: RichTextReport, renderTitle: boolean): void {
		this.updateCountVariables();
		if (renderTitle) {
			report.addHtmlContent(`<h3>${this.title}</h3>`);
		}

		if (this.explorers) {
			report.startDiv("");
			report.addHtmlContent("Explore:&nbsp;&nbsp;");
			report.addNewTabLink(
				"circles",
				`visuals/zoomable_circles_${this.explorers}.html`,
			);
			report.addHtmlContent("&nbsp;|&nbsp;");
			report.addNewTabLink(
				"sunburst",
				`visuals/zoomable_sunburst_${this.explorers}.html`,
			);
			report.endDiv();
		}

		if (this.filesCount === 0) {
			report.startUnorderedList();
			report.addListItem(`There are no "${this.title.toLowerCase()}" files.`);
			report.endUnorderedList();
			return;
		}

		if (this.description) {
			report.startUnorderedList();
			report.addListItem(this.description);
			report.endUnorderedList();
		}

		report.startUnorderedList();
		report.addListItem(
			`<b>${FormattingUtils.formatCount(this.filesCount)}</b> files, ` +
				`<b>${FormattingUtils.formatCount(this.linesCount)}</b> ${this.metric} (` +
				`<b>${FormattingUtils.formatCount((100.0 * this.linesCount) / this.maxLinesOfCode)}</b>% vs. main code).`,
		);
		report.endUnorderedList();
	}

	private getRenderingList(): ScopeRendererItem[] {
		const items: ScopeRendererItem[] = [];
		for (let i = 0; i < this.linesOfCode.length; i++) {
			const item = new ScopeRendererItem();
			item.linesOfCode = this.linesOfCode[i]!;
			if (this.describe && this.fileCountPerComponent.length > i) {
				item.filesCount = this.fileCountPerComponent[i]!;
				const count = this.fileCountPerComponent[i]!.value;
				let filesFragment = FormattingUtils.formatCountPlural(
					count,
					"file",
					"files",
				);
				if (this.aspectsFileListPaths.length > i && count > 0) {
					filesFragment = `<u><a target='_blank' href='../data/text/aspect_${this.aspectsFileListPaths[i]}.txt'>${filesFragment}</a></u>`;
				}
				item.filesFragment = filesFragment;
			}
			items.push(item);
		}

		if (this.sort) {
			items.sort((a, b) => b.linesOfCode.value - a.linesOfCode.value);
		}

		return items;
	}

	private getSvgBars(
		report: RichTextReport,
		renderingList: ScopeRendererItem[],
	): void {
		const chart = new SimpleOneBarChart();
		chart.width = 800;
		chart.maxBarWidth = 200;
		chart.barHeight = 20;
		chart.activeColor = this.activeColor;

		report.startDiv("width: 100%; overflow-x: auto");
		report.startDiv("min-width: 1000px");
		for (const item of renderingList) {
			const metricLoc = item.linesOfCode.value;
			const percentage = (100.0 * metricLoc) / this.maxLinesOfCode;
			const filesFragment = item.filesFragment || "";
			const textRight = `${metricLoc} ${this.metric} (${FormattingUtils.getFormattedPercentage(percentage)}%) ${filesFragment}`;
			report.addContentInDiv(
				chart.getPercentageSvg(percentage, item.linesOfCode.name, textRight),
			);
		}
		report.endDiv();
		report.endDiv();
	}

	private updateCountVariables(): void {
		this.filesCount = 0;
		this.linesCount = 0;
		for (const fc of this.fileCountPerComponent) {
			this.filesCount += fc.value;
		}
		for (const loc of this.linesOfCode) {
			this.linesCount += loc.value;
		}
	}
}
