import type { CodeAnalysisResults, ComponentDependency, LogicalDecompositionAnalysisResults } from "@planetnik/analyzer"
import type { RichTextReport } from "../core/RichTextReport.js"

export class LogicalComponentsReportGenerator {
  static addComponentsToReport(report: RichTextReport, results: CodeAnalysisResults, skipDependencies: boolean): void {
    if (skipDependencies) {
      report.addParagraph("An overview of source code logical components.", "margin-top: 12px; color: grey")
    } else {
      report.addParagraph(
        "An overview of static code dependencies among source code logical components.",
        "margin-top: 12px; color: grey",
      )
    }

    const decompositions = results.logicalDecompositionsAnalysisResults
    if (decompositions.length === 0) {
      report.addParagraph("No logical decompositions defined.")
      return
    }

    report.startSection("Logical Decompositions Overview", "")
    report.addParagraph(
      `Analyzed system has <b>${decompositions.length}</b> logical decomposition${decompositions.length > 1 ? "s" : ""}:`,
    )
    report.startUnorderedList()
    for (const decomp of decompositions) {
      const count = decomp.components.length
      report.addListItem(`${decomp.key} (${count} component${count > 1 ? "s" : ""})`)
    }
    report.endUnorderedList()
    report.endSection()

    for (const decomp of decompositions) {
      LogicalComponentsReportGenerator.addDecompositionSection(report, results, decomp, skipDependencies)
    }
  }

  private static addDecompositionSection(
    report: RichTextReport,
    _results: CodeAnalysisResults,
    decomp: LogicalDecompositionAnalysisResults,
    skipDependencies: boolean,
  ): void {
    report.startSection(`Logical Decomposition: ${decomp.key}`, "")

    // Component sizes table
    report.startSubSection("Component Sizes (Lines of Code)", "")
    const locMetrics = decomp.getLinesOfCodePerComponent()
    const fileMetrics = decomp.getFileCountPerComponent()

    if (locMetrics.length > 0) {
      report.startTable()
      report.addTableHeaderLeft("Component", "Files", "Lines of Code")
      for (let i = 0; i < locMetrics.length; i++) {
        const loc = locMetrics[i]!
        const files = fileMetrics[i]
        report.startTableRow()
        report.addTableCell(loc.name)
        report.addTableCell(`${files?.value ?? 0}`)
        report.addTableCell(`${loc.value}`)
        report.endTableRow()
      }
      report.endTable()
    }

    // Static dependencies
    if (!skipDependencies) {
      LogicalComponentsReportGenerator.addDependenciesSection(report, decomp)
    }

    report.endSection()
  }

  private static addDependenciesSection(report: RichTextReport, decomp: LogicalDecompositionAnalysisResults): void {
    const deps = decomp.componentDependencies
    report.startSubSection("Static Dependencies", "Dependencies among components")

    if (deps.length === 0) {
      report.addParagraph("No component dependencies found.")
      return
    }

    report.startUnorderedList()
    report.addListItem(`Analyzed system has <b>${deps.length}</b> links between components.`)
    const totalCount = deps.reduce((sum, d) => sum + d.count, 0)
    report.addListItem(`These links contain <b>${totalCount}</b> dependencies.`)

    const cyclicCount = LogicalComponentsReportGenerator.countCyclicDependencies(deps)
    if (cyclicCount > 0) {
      report.addListItem(`There are <b>${cyclicCount}</b> cyclic dependency pairs.`)
    }
    report.endUnorderedList()

    // Dependencies table
    report.startDiv("max-height: 400px; overflow-y: auto")
    report.startTable()
    report.addTableHeaderLeft("From", "To", "Count")
    const sorted = [...deps].sort((a, b) => b.count - a.count)
    for (const dep of sorted) {
      report.startTableRow()
      report.addTableCell(dep.fromComponent)
      report.addTableCell(dep.toComponent)
      report.addTableCell(`${dep.count}`)
      report.endTableRow()
    }
    report.endTable()
    report.endDiv()
  }

  private static countCyclicDependencies(deps: ComponentDependency[]): number {
    let count = 0
    for (let i = 0; i < deps.length; i++) {
      for (let j = i + 1; j < deps.length; j++) {
        const a = deps[i]!
        const b = deps[j]!
        if (a.fromComponent === b.toComponent && a.toComponent === b.fromComponent) {
          count++
        }
      }
    }
    return count
  }
}
