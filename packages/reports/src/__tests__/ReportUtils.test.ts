import { describe, expect, test } from "bun:test"
import {
  ComponentDependency,
  Contributor,
  DuplicationMetric,
  NumericMetric,
  RiskDistributionStats,
  SourceFile,
  UnitInfo,
} from "@planetnik/analyzer"
import { Palette } from "@planetnik/common"
import { Alignment, SimpleOneBarChart } from "../charts/SimpleOneBarChart.js"
import { RichTextReport } from "../core/RichTextReport.js"
import { RiskDistributionReportUtils } from "../generators/RiskDistributionReportUtils.js"
import { ChartUtils } from "../utils/ChartUtils.js"
import { ContributorsReportUtils } from "../utils/ContributorsReportUtils.js"
import { DataImageUtils } from "../utils/DataImageUtils.js"
import { ReportDateUtils } from "../utils/DateUtils.js"
import { DuplicationReportUtils } from "../utils/DuplicationReportUtils.js"
import { FilesReportUtils } from "../utils/FilesReportUtils.js"
import { GraphvizDependencyRenderer } from "../utils/GraphvizDependencyRenderer.js"
import { PieChartUtils } from "../utils/PieChartUtils.js"
import { ReportUtils } from "../utils/ReportUtils.js"
import { ScopesRenderer } from "../utils/ScopesRenderer.js"
import { UtilsReportUtils } from "../utils/UtilsReportUtils.js"

describe("SimpleOneBarChart", () => {
  test("getPercentageSvg generates svg with bar", () => {
    const chart = new SimpleOneBarChart()
    chart.width = 400
    chart.maxBarWidth = 100
    chart.barHeight = 20
    const svg = chart.getPercentageSvg(50, "Label", "50%")
    expect(svg).toContain("<svg")
    expect(svg).toContain("Label")
    expect(svg).toContain("50%")
    expect(svg).toContain("</svg>")
  })

  test("getSvg generates valid svg", () => {
    const chart = new SimpleOneBarChart()
    const svg = chart.getSvg(100, "Left", "Right")
    expect(svg).toContain("Left")
    expect(svg).toContain("Right")
  })

  test("alignment defaults to LEFT", () => {
    const chart = new SimpleOneBarChart()
    expect(chart.alignment).toBe(Alignment.LEFT)
  })

  test("calculateBarOffsetFromTexts adjusts offset", () => {
    const chart = new SimpleOneBarChart()
    chart.calculateBarOffsetFromTexts(["short", "a much longer text label"])
    expect(chart.barStartXOffset).toBeGreaterThanOrEqual(100)
    expect(chart.barStartXOffset).toBeLessThanOrEqual(400)
  })

  test("getStackedBarSvg renders stacked bars", () => {
    const chart = new SimpleOneBarChart()
    chart.barStartXOffset = 0
    const palette = Palette.getRiskPalette()
    const svg = chart.getStackedBarSvg([30, 20, 50], palette, "Test", "100")
    expect(svg).toContain("<svg")
    expect(svg).toContain("Test")
    expect(svg).toContain("100")
  })

  test("getLegend renders color boxes with labels", () => {
    const chart = new SimpleOneBarChart()
    const palette = Palette.getRiskPalette()
    const html = chart.getLegend(["High", "Low"], palette)
    expect(html).toContain("High")
    expect(html).toContain("Low")
    expect(html).toContain("background-color:")
  })

  test("setSmallerFontSize changes font size", () => {
    const chart = new SimpleOneBarChart()
    chart.setSmallerFontSize()
    expect(chart.fontSize).toBe("smaller")
  })
})

describe("ReportUtils", () => {
  test("getSvgBar generates bar svg", () => {
    const svg = ReportUtils.getSvgBar(50, 100, "blue")
    expect(svg).toContain("<svg")
    expect(svg).toContain("blue")
    expect(svg).toContain("lightgrey")
  })

  test("getSvgCircle generates circle svg", () => {
    const svg = ReportUtils.getSvgCircle("red")
    expect(svg).toContain("<circle")
    expect(svg).toContain("red")
  })

  test("formatNumber formats with commas", () => {
    expect(ReportUtils.formatNumber(1234567)).toBe("1,234,567")
    expect(ReportUtils.formatNumber(42.5)).toBe("42.5")
    expect(ReportUtils.formatNumber(Number.NaN)).toBe("-")
  })
})

describe("ReportDateUtils", () => {
  test("getCurrentDateTime returns date-time string", () => {
    const dt = ReportDateUtils.getCurrentDateTime()
    expect(dt).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })
})

describe("DataImageUtils", () => {
  test("getLangDisplayName returns known language", () => {
    expect(DataImageUtils.getLangDisplayName("java")).toBe("Java")
    expect(DataImageUtils.getLangDisplayName("ts")).toBe("TypeScript")
    expect(DataImageUtils.getLangDisplayName("py")).toBe("Python")
  })

  test("getLangDisplayName returns extension for unknown", () => {
    expect(DataImageUtils.getLangDisplayName("xyz")).toBe("xyz")
  })

  test("getLangDataImageDiv30 generates div with lang text", () => {
    const div = DataImageUtils.getLangDataImageDiv30("ts")
    expect(div).toContain("ts")
    expect(div).toContain("30px")
    expect(div).toContain("border-radius: 50%")
  })

  test("getLangDataImageDiv uses different font sizes based on length", () => {
    const short = DataImageUtils.getLangDataImageDiv("ts", 30, 13, 11, 7, 9)
    expect(short).toContain("font-size: 13px")
    const long = DataImageUtils.getLangDataImageDiv("java", 30, 13, 11, 7, 9)
    expect(long).toContain("font-size: 11px")
  })
})

describe("GraphvizDependencyRenderer", () => {
  test("encodeLabel escapes special chars", () => {
    expect(GraphvizDependencyRenderer.encodeLabel('hello "world"')).toBe('hello \\"world\\"')
    expect(GraphvizDependencyRenderer.encodeLabel("path\\to")).toBe("path\\\\to")
    expect(GraphvizDependencyRenderer.encodeLabel("tab\there")).toBe("tab here")
  })

  test("getGraphvizContent generates valid graphviz", () => {
    const renderer = new GraphvizDependencyRenderer()
    const dep = new ComponentDependency("A", "B")
    dep.count = 5
    const result = renderer.getGraphvizContent(["A", "B"], [dep])
    expect(result).toContain("digraph G")
    expect(result).toContain('"A"')
    expect(result).toContain('"B"')
    expect(result).toContain("->")
  })

  test("detects cyclic dependencies", () => {
    const renderer = new GraphvizDependencyRenderer()
    const dep1 = new ComponentDependency("A", "B")
    dep1.count = 3
    const dep2 = new ComponentDependency("B", "A")
    dep2.count = 2
    const result = renderer.getGraphvizContent(["A", "B"], [dep1, dep2])
    expect(result).toContain("DC143C") // cyclic arrow color
  })

  test("setTypeGraph switches to graph mode", () => {
    const renderer = new GraphvizDependencyRenderer()
    renderer.setTypeGraph()
    const dep = new ComponentDependency("A", "B")
    dep.count = 1
    const result = renderer.getGraphvizContent(["A", "B"], [dep])
    expect(result).toContain("graph G")
    expect(result).toContain("--")
  })

  test("handles component groups", () => {
    const renderer = new GraphvizDependencyRenderer()
    const result = renderer.getGraphvizContent(["A", "B"], [], [{ name: "Group1", componentNames: ["A", "B"] }])
    expect(result).toContain("subgraph cluster_1")
    expect(result).toContain("Group1")
  })
})

describe("RiskDistributionReportUtils.getRowData", () => {
  test("returns values in risk order", () => {
    const stats = new RiskDistributionStats(10, 20, 50, 100)
    stats.veryHighRiskValue = 400
    stats.highRiskValue = 300
    stats.mediumRiskValue = 200
    stats.lowRiskValue = 100
    stats.negligibleRiskValue = 50
    const data = RiskDistributionReportUtils.getRowData(stats)
    expect(data).toEqual([400, 300, 200, 100, 50])
  })
})

describe("PieChartUtils", () => {
  test("getRiskDistributionChart generates chart html", () => {
    const stats = new RiskDistributionStats(10, 20, 50, 100)
    stats.veryHighRiskValue = 10
    stats.highRiskValue = 20
    stats.mediumRiskValue = 30
    stats.lowRiskValue = 40
    stats.negligibleRiskValue = 50
    stats.key = "Test"

    const html = PieChartUtils.getRiskDistributionChart(stats, ["VH", "H", "M", "L", "N"])
    expect(html).toContain("Test")
    expect(html).toContain("Legend:")
    expect(html).toContain("<svg")
  })
})

describe("DuplicationReportUtils", () => {
  test("addOverallDuplication generates duplication bar", () => {
    const report = new RichTextReport("test", "test.html")
    const metric = new DuplicationMetric("overall", 1000, 200)
    DuplicationReportUtils.addOverallDuplication(report, metric)
    const html = report.renderToString()
    expect(html).toContain("crimson")
    expect(html).toContain("<svg")
  })

  test("addDuplicationPerAspect handles multiple metrics", () => {
    const report = new RichTextReport("test", "test.html")
    const metrics = [new DuplicationMetric("module-a", 500, 100), new DuplicationMetric("module-b", 300, 60)]
    DuplicationReportUtils.addDuplicationPerAspect(report, metrics)
    const html = report.renderToString()
    expect(html).toContain("module-a")
    expect(html).toContain("module-b")
  })
})

describe("ChartUtils", () => {
  test("addVolumeBarChart renders metrics as bars", () => {
    const report = new RichTextReport("test", "test.html")
    const metrics = [new NumericMetric("Component A", 500), new NumericMetric("Component B", 300)]
    ChartUtils.addVolumeBarChart(report, metrics)
    const html = report.renderToString()
    expect(html).toContain("Component A")
    expect(html).toContain("Component B")
  })

  test("addVolumeBarChart skips empty metrics", () => {
    const report = new RichTextReport("test", "test.html")
    ChartUtils.addVolumeBarChart(report, [new NumericMetric("Zero", 0)])
    const html = report.renderToString()
    expect(html).toBe("")
  })
})

describe("ScopesRenderer", () => {
  test("renderReport generates section with bars", () => {
    const report = new RichTextReport("test", "test.html")
    const renderer = new ScopesRenderer()
    renderer.title = "Components"
    renderer.maxLinesOfCode = 1000
    renderer.fileCountPerComponent = [new NumericMetric("A", 10), new NumericMetric("B", 5)]
    renderer.linesOfCode = [new NumericMetric("A", 600), new NumericMetric("B", 400)]

    renderer.renderReport(report, "Test description")
    const html = report.renderToString()
    expect(html).toContain("Components")
    expect(html).toContain("<svg")
  })

  test("renderReport does nothing with empty data", () => {
    const report = new RichTextReport("test", "test.html")
    const renderer = new ScopesRenderer()
    renderer.renderReport(report, "empty")
    const html = report.renderToString()
    expect(html).toBe("")
  })
})

describe("FilesReportUtils", () => {
  test("getFilesTable generates table with file info", () => {
    const file = new SourceFile("src/app.ts")
    file.linesOfCode = 100
    const table = FilesReportUtils.getFilesTable([file], false, false, false)
    expect(table).toContain("app.ts")
    expect(table).toContain("100")
    expect(table).toContain("<table")
  })

  test("getFilesTable includes long lines column when requested", () => {
    const file = new SourceFile("src/app.ts")
    const table = FilesReportUtils.getFilesTable([file], false, false, true)
    expect(table).toContain("# long lines")
  })
})

describe("UtilsReportUtils", () => {
  test("getUnitsTable generates table with unit info", () => {
    const unit = new UnitInfo()
    unit.shortName = "doSomething"
    unit.linesOfCode = 25
    unit.mcCabeIndex = 3
    unit.numberOfParameters = 2
    unit.sourceFile = new SourceFile("src/app.ts")
    const table = UtilsReportUtils.getUnitsTable([unit], "large", false, false)
    expect(table).toContain("doSomething")
    expect(table).toContain("25")
    expect(table).toContain("3")
    expect(table).toContain("2")
  })

  test("getUnitsTable skips units without sourceFile", () => {
    const unit = new UnitInfo()
    unit.shortName = "orphan"
    const table = UtilsReportUtils.getUnitsTable([unit], "large", false, false)
    expect(table).not.toContain("orphan")
  })
})

describe("ContributorsReportUtils", () => {
  test("addContributors renders contributor sections", () => {
    const report = new RichTextReport("test", "test.html")
    const contributor = new Contributor()
    contributor.email = "alice@test.com"
    contributor.commitsCount = 42
    contributor.commitsCount30Days = 5
    contributor.firstCommitDate = "2024-01-01"
    contributor.latestCommitDate = "2024-06-15"
    ContributorsReportUtils.addContributors(report, [contributor], "Contributors")
    const html = report.renderToString()
    expect(html).toContain("alice@test.com")
    expect(html).toContain("Contributors")
    expect(html).toContain("Past 30 days")
  })
})

describe("RichTextReport additions", () => {
  test("addLevel2Header with style", () => {
    const report = new RichTextReport("test", "test.html")
    report.addLevel2Header("Title", "margin-top: 40px")
    const html = report.renderToString()
    expect(html).toContain('style="margin-top: 40px"')
    expect(html).toContain("Title")
  })

  test("addTextArea", () => {
    const report = new RichTextReport("test", "test.html")
    report.addTextArea("some content", "width: 100%")
    const html = report.renderToString()
    expect(html).toContain("<textarea")
    expect(html).toContain("some content")
    expect(html).toContain("width: 100%")
  })
})
