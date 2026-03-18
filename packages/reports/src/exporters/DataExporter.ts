import { existsSync, mkdirSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import type { CodeAnalysisResults, ComponentDependency, Contributor, DuplicationInstance, SourceFile } from "@planetnik/analyzer"
import { Range } from "@planetnik/analyzer"
import { FormattingUtils } from "@planetnik/common"
import { DataExportUtils } from "./DataExportUtils.js"
import { DependenciesExporter } from "./DependenciesExportInfo.js"
import { DuplicationExporter } from "./DuplicationExportInfo.js"
import { FileListExporter } from "./FilesExportInfo.js"
import { UnitListExporter } from "./UnitsExportInfo.js"

export class DataExporter {
  static readonly DATA_FOLDER_NAME = "data"
  static readonly SEPARATOR = "- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -\n"
  static readonly MAX_EXPORT_LIST_SIZE = 10000

  private analysisResults: CodeAnalysisResults
  private reportsFolder: string

  constructor(analysisResults: CodeAnalysisResults, reportsFolder: string) {
    this.analysisResults = analysisResults
    this.reportsFolder = reportsFolder
  }

  exportData(): void {
    const dataFolder = join(this.reportsFolder, DataExporter.DATA_FOLDER_NAME)
    if (!existsSync(dataFolder)) {
      mkdirSync(dataFolder, { recursive: true })
    }

    this.exportFileLists(dataFolder)
    this.exportMetrics(dataFolder)
    this.exportControls(dataFolder)
    this.exportContributors(dataFolder)
    this.exportContributorDetails(dataFolder)
    this.exportJson(dataFolder)
    this.exportDuplicates(dataFolder)
    this.exportUnits(dataFolder)
    this.exportDependencies(dataFolder)
    this.exportTemporalDependencies(dataFolder)
    this.exportPeopleDependencies(dataFolder)
    this.exportCommitsPerExtension(dataFolder)
    this.exportContributorTimeline(dataFolder)
  }

  private exportFileLists(dataFolder: string): void {
    const config = this.analysisResults.codeConfiguration
    if (!config) return

    const timestamp = new Date().toISOString()
    const srcRoot = config.srcRoot ?? ""

    const mainFiles = config.main.sourceFiles ?? []
    if (mainFiles.length > 0) {
      const fileExport = FileListExporter.exportFiles(mainFiles, "Main", srcRoot, timestamp)
      writeFileSync(join(dataFolder, "files_main.json"), JSON.stringify(fileExport, null, 2), "utf-8")
    }

    const testFiles = config.test?.sourceFiles ?? []
    if (testFiles.length > 0) {
      const fileExport = FileListExporter.exportFiles(testFiles, "Test", srcRoot, timestamp)
      writeFileSync(join(dataFolder, "files_test.json"), JSON.stringify(fileExport, null, 2), "utf-8")
    }

    // Export simple file list (tab-separated)
    const allFiles = mainFiles
    const fileList = allFiles.map((f) => `${f.relativePath}\t${f.linesOfCode}\t${f.extension}`).join("\n")
    writeFileSync(join(dataFolder, "files.txt"), fileList, "utf-8")

    // Export per-component file lists
    for (const decomposition of this.analysisResults.logicalDecompositionsAnalysisResults) {
      for (const component of decomposition.components) {
        const aspect = component.aspect
        if (aspect) {
          const prefix = DataExportUtils.getComponentFileName("component_files_", decomposition.key)
          const content = aspect.sourceFiles
            .sort((a, b) => a.relativePath.localeCompare(b.relativePath))
            .map((f) => `${f.relativePath}\t${f.linesOfCode}`)
            .join("\n")
          writeFileSync(
            join(dataFolder, `${prefix}_${DataExportUtils.getAspectFileName("", aspect.name)}.txt`),
            `Path\tLines of Code\n${content}`,
            "utf-8",
          )
        }
      }
    }
  }

  private exportMetrics(dataFolder: string): void {
    const lines = this.analysisResults.metricsList.metrics.map((m) => `${m.id}: ${m.value}`).join("\n")
    writeFileSync(join(dataFolder, "metrics.txt"), lines, "utf-8")
  }

  private exportControls(dataFolder: string): void {
    const lines: string[] = []

    for (const goal of this.analysisResults.controlResults.goalsAnalysisResults) {
      for (const status of goal.controlStatuses) {
        if (goal.metricsWithGoal) {
          lines.push(`goal: ${goal.metricsWithGoal.goal}`)
        }
        if (status.metric) {
          lines.push(`control metric: ${status.metric.id}`)
        }
        lines.push(`status: ${status.status}`)
        if (status.control) {
          lines.push(`desired range: ${Range.getTextDescription(status.control.desiredRange)}`)
          lines.push(`description: ${status.control.description}`)
        }
        if (status.metric) {
          lines.push(`value: ${status.metric.value}`)
        }
        lines.push("")
      }
    }

    writeFileSync(join(dataFolder, "controls.txt"), lines.join("\n"), "utf-8")
  }

  private exportContributors(dataFolder: string): void {
    const contributors = this.analysisResults.contributorsAnalysisResults.contributors
    if (contributors.length === 0) return

    const total = contributors.reduce((sum: number, c: Contributor) => sum + c.commitsCount, 0)
    const lines: string[] = []
    lines.push(
      "Contributor\t#commits (all time)\t#commits (30 days)\t#commits (90 days)\t#commits (180 days)\t#commits (365 days)\tfirst commit\tlast commit\tpercentage\tuserName\tisRookie\tisActive",
    )

    for (const c of contributors) {
      const percentage = total > 0 ? FormattingUtils.getFormattedPercentage((100.0 * c.commitsCount) / total) : "0%"
      lines.push(
        `${c.email}\t${c.commitsCount}\t${c.commitsCount30Days}\t${c.commitsCount90Days}\t${c.commitsCount180Days}\t${c.commitsCount365Days}\t${c.firstCommitDate}\t${c.latestCommitDate}\t${percentage}\t${c.userName}\t${c.isRookie()}\t${c.isActive()}`,
      )
    }

    writeFileSync(join(dataFolder, "contributors.txt"), lines.join("\n"), "utf-8")
  }

  private exportContributorDetails(dataFolder: string): void {
    const contributors = this.analysisResults.contributorsAnalysisResults.contributors
    if (contributors.length === 0) return

    const detailsFolder = join(dataFolder, "contributor_details")
    if (!existsSync(detailsFolder)) {
      mkdirSync(detailsFolder, { recursive: true })
    }

    const sourceFiles = this.getAllSourceFiles()
    const collaboratorMap = this.getCollaboratorsByContributor()

    for (const contributor of contributors) {
      const exportInfo = this.buildContributorDetailExport(contributor, sourceFiles, collaboratorMap.get(contributor.email) ?? [])
      const fileName = `${encodeURIComponent(contributor.email)}.json`
      writeFileSync(join(detailsFolder, fileName), JSON.stringify(exportInfo, null, 2), "utf-8")
    }
  }

  private exportJson(dataFolder: string): void {
    const summary = {
      metadata: this.analysisResults.codeConfiguration?.metadata,
      filesCount: this.analysisResults.mainAspectAnalysisResults?.filesCount ?? 0,
      linesOfCode: this.analysisResults.mainAspectAnalysisResults?.linesOfCode ?? 0,
      duplication: {
        percentage: this.analysisResults.duplicationAnalysisResults.overallDuplication.getDuplicationPercentage(),
        duplicatedLines: this.analysisResults.duplicationAnalysisResults.overallDuplication.duplicatedLinesOfCode,
        cleanedLines: this.analysisResults.duplicationAnalysisResults.overallDuplication.cleanedLinesOfCode,
      },
    }
    writeFileSync(join(dataFolder, "analysisResults.json"), JSON.stringify(summary, null, 2), "utf-8")
  }

  private exportDuplicates(dataFolder: string): void {
    const timestamp = new Date().toISOString()

    this.exportDuplicatesList(
      this.analysisResults.duplicationAnalysisResults.allDuplicates,
      "duplicates",
      dataFolder,
      timestamp,
    )
    this.exportDuplicatesList(
      this.analysisResults.duplicationAnalysisResults.unitDuplicates,
      "unit_duplicates",
      dataFolder,
      timestamp,
    )
  }

  private exportDuplicatesList(
    instances: DuplicationInstance[],
    fileName: string,
    dataFolder: string,
    timestamp: string,
  ): void {
    if (instances.length === 0) return

    const exportInfo = DuplicationExporter.exportDuplication(instances, "Duplication", timestamp)
    writeFileSync(join(dataFolder, `${fileName}.json`), JSON.stringify(exportInfo, null, 2), "utf-8")

    // Text format
    const lines: string[] = []
    const limited =
      instances.length > DataExporter.MAX_EXPORT_LIST_SIZE
        ? instances.slice(0, DataExporter.MAX_EXPORT_LIST_SIZE)
        : instances
    let id = 1
    for (const dup of limited) {
      lines.push(`duplicated block id: ${id}`)
      lines.push(`size: ${dup.blockSize} cleaned lines of code`)
      lines.push(`in ${dup.duplicatedFileBlocks.length} files:`)
      for (const block of dup.duplicatedFileBlocks) {
        lines.push(` - ${block.sourceFile?.relativePath ?? ""} (${block.startLine}:${block.endLine})`)
      }
      lines.push("")
      id++
    }
    writeFileSync(join(dataFolder, `${fileName}.txt`), lines.join("\n"), "utf-8")
  }

  private exportUnits(dataFolder: string): void {
    const timestamp = new Date().toISOString()
    const srcRoot = this.analysisResults.codeConfiguration?.srcRoot ?? ""
    const units = this.analysisResults.unitsAnalysisResults.allUnits

    if (units.length > 0) {
      const unitExport = UnitListExporter.exportUnits(units, "All Units", srcRoot, timestamp)
      writeFileSync(join(dataFolder, "units.json"), JSON.stringify(unitExport, null, 2), "utf-8")
    }

    // Text format
    const lines: string[] = []
    let id = 1
    for (const u of units) {
      lines.push(`id: ${id}`)
      lines.push(`unit: ${u.shortName}`)
      lines.push(`file: ${u.sourceFile?.relativePath ?? ""}`)
      lines.push(`start line: ${u.startLine}`)
      lines.push(`end line: ${u.endLine}`)
      lines.push(`size: ${u.linesOfCode} LOC`)
      lines.push(`McCabe index: ${u.mcCabeIndex}`)
      lines.push(`number of parameters: ${u.numberOfParameters}`)
      lines.push("")
      id++
    }
    writeFileSync(join(dataFolder, "units.txt"), lines.join("\n"), "utf-8")
  }

  private exportDependencies(dataFolder: string): void {
    const timestamp = new Date().toISOString()

    // Export all dependencies
    if (this.analysisResults.allDependencies.length > 0) {
      const depExport = DependenciesExporter.exportDependencies(
        this.analysisResults.allDependencies,
        "Dependencies",
        timestamp,
      )
      writeFileSync(join(dataFolder, "dependencies.json"), JSON.stringify(depExport, null, 2), "utf-8")
    }

    // Export per-logical-decomposition component dependencies
    for (const decomposition of this.analysisResults.logicalDecompositionsAnalysisResults) {
      const name = decomposition.key
      const deps = decomposition.componentDependencies
      if (deps.length === 0) continue

      // All dependencies for this decomposition
      this.exportComponentDependencies(deps, "", "", name, dataFolder)

      // Per-component-pair dependencies
      for (const dep of deps) {
        this.exportComponentDependencies(deps, dep.fromComponent, dep.toComponent, name, dataFolder)
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
    const lines: string[] = []
    const safeDecomp = decompositionName.replace(/[^a-zA-Z0-9._-]/g, "_")
    let fileNamePrefix = `dependencies_${safeDecomp}`
    if (filterFrom && filterTo) {
      const safeFrom = filterFrom.replace(/[^a-zA-Z0-9._-]/g, "_")
      const safeTo = filterTo.replace(/[^a-zA-Z0-9._-]/g, "_")
      fileNamePrefix += `_${safeFrom}_${safeTo}`
    }

    for (const dep of dependencies) {
      if (filterFrom && filterTo) {
        if (
          dep.fromComponent.toLowerCase() !== filterFrom.toLowerCase() ||
          dep.toComponent.toLowerCase() !== filterTo.toLowerCase()
        )
          continue
      }
      for (const evidence of dep.evidence) {
        lines.push(`from: ${dep.fromComponent}`)
        lines.push(`to: ${dep.toComponent}`)
        lines.push("evidence:")
        lines.push(` - file: "${evidence.pathFrom}"`)
        lines.push(`   contains "${evidence.evidence}"`)
        lines.push("")
      }
    }

    writeFileSync(join(dataFolder, `${fileNamePrefix}.txt`), lines.join("\n"), "utf-8")
  }

  private exportTemporalDependencies(dataFolder: string): void {
    const historyResults = this.analysisResults.filesHistoryAnalysisResults

    this.exportFilePairsChangedTogether(
      historyResults.filePairsChangedTogether,
      "temporal_dependencies.txt",
      dataFolder,
    )
    this.exportFilePairsChangedTogether(
      historyResults.filePairsChangedTogether30Days,
      "temporal_dependencies_30_days.txt",
      dataFolder,
    )
  }

  private exportFilePairsChangedTogether(
    pairs: Array<{
      sourceFile1Path: string
      sourceFile2Path: string
      commitsCountFile1: number
      commitsCountFile2: number
      commits: string[]
    }>,
    fileName: string,
    dataFolder: string,
  ): void {
    const lines: string[] = []
    lines.push("file 1\tfile 2\t# same commits\t# commits file 1\t# commits file 2")

    const sorted = [...pairs].sort((a, b) => b.commits.length - a.commits.length)
    const limited = sorted.slice(0, DataExporter.MAX_EXPORT_LIST_SIZE)

    for (const pair of limited) {
      lines.push(
        `${pair.sourceFile1Path}\t${pair.sourceFile2Path}\t${pair.commits.length}\t${pair.commitsCountFile1}\t${pair.commitsCountFile2}`,
      )
    }

    writeFileSync(join(dataFolder, fileName), lines.join("\n"), "utf-8")
  }

  private exportPeopleDependencies(dataFolder: string): void {
    const contribResults = this.analysisResults.contributorsAnalysisResults

    const exportDeps = (deps: ComponentDependency[], fileName: string) => {
      if (deps.length === 0) return
      const limited = deps.slice(0, DataExporter.MAX_EXPORT_LIST_SIZE)
      const exported = limited.map((d) => ({
        from: d.fromComponent,
        to: d.toComponent,
        count: d.count,
        files: d.data,
      }))
      writeFileSync(join(dataFolder, fileName), JSON.stringify(exported, null, 2), "utf-8")
    }

    exportDeps(contribResults.peopleDependencies30Days, "people_dependencies_30d.json")
    exportDeps(contribResults.peopleDependencies90Days, "people_dependencies_90d.json")
    exportDeps(contribResults.peopleDependencies180Days, "people_dependencies_180d.json")
    exportDeps(contribResults.peopleDependencies365Days, "people_dependencies_365d.json")
    exportDeps(contribResults.peopleDependenciesAllTime, "people_dependencies.json")
  }

  private exportCommitsPerExtension(dataFolder: string): void {
    const commitsPerExtension = this.analysisResults.contributorsAnalysisResults.commitsPerExtension
    if (commitsPerExtension.length === 0) return

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
    }))

    writeFileSync(join(dataFolder, "commits_per_extension.json"), JSON.stringify(exported, null, 2), "utf-8")
  }

  private exportContributorTimeline(dataFolder: string): void {
    const contribResults = this.analysisResults.contributorsAnalysisResults

    const exportSlots = (slots: Array<{ timeSlot: string; contributorsCount: number; commitsCount: number }>) =>
      slots
        .filter((s) => s.commitsCount > 0)
        .map((s) => ({
          timeSlot: s.timeSlot,
          contributors: s.contributorsCount,
          commits: s.commitsCount,
        }))

    const perYear = exportSlots(contribResults.contributorsPerYear)
    const perMonth = exportSlots(contribResults.contributorsPerMonth)

    if (perYear.length === 0 && perMonth.length === 0) return

    const timeline = { perYear, perMonth }
    writeFileSync(join(dataFolder, "contributor_timeline.json"), JSON.stringify(timeline, null, 2), "utf-8")
  }

  private buildContributorDetailExport(
    contributor: Contributor,
    sourceFiles: SourceFile[],
    collaborators: Array<{ email: string; sharedFiles: number }>,
  ) {
    const dailyActivity = new Map<string, number>()
    const seenCommitIds = new Set<string>()
    const extensionStats = new Map<string, { commitIds: Set<string>; files: Set<string> }>()
    const logicalComponentStats = new Map<string, { files: Set<string>; linesOfCode: number }>()
    const concernStats = new Map<string, { files: Set<string>; linesOfCode: number }>()

    const files = sourceFiles
      .map((file) => {
        const commits = file.fileModificationHistory?.commits ?? []
        const matchingCommits = commits.filter((commit) => commit.email === contributor.email)
        if (matchingCommits.length === 0) return null

        const fileCommitIds = new Set<string>()

        for (const [index, commit] of matchingCommits.entries()) {
          const commitId = this.getContributorCommitId(commit.id, commit.date, file.relativePath, index)
          fileCommitIds.add(commitId)

          if (!seenCommitIds.has(commitId)) {
            seenCommitIds.add(commitId)
            dailyActivity.set(commit.date, (dailyActivity.get(commit.date) ?? 0) + 1)
          }

          const extensionKey = file.extension || ""
          const extension = extensionStats.get(extensionKey) ?? { commitIds: new Set<string>(), files: new Set<string>() }
          extension.commitIds.add(commitId)
          extension.files.add(file.relativePath)
          extensionStats.set(extensionKey, extension)
        }

        for (const component of file.logicalComponents) {
          this.addFootprintEntry(logicalComponentStats, component.name, file.relativePath, file.linesOfCode)
        }
        for (const concern of file.concerns) {
          this.addFootprintEntry(concernStats, concern.name, file.relativePath, file.linesOfCode)
        }

        return {
          relativePath: file.relativePath,
          extension: file.extension,
          commits: fileCommitIds.size,
          logicalComponents: file.logicalComponents.map((component) => component.name).sort(),
          concerns: file.concerns.map((concern) => concern.name).sort(),
        }
      })
      .filter((file): file is NonNullable<typeof file> => file !== null)
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath))

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
    }
  }

  private getAllSourceFiles(): SourceFile[] {
    const config = this.analysisResults.codeConfiguration
    if (!config) return []

    const files = [
      ...config.main.sourceFiles,
      ...config.test.sourceFiles,
      ...config.generated.sourceFiles,
      ...config.buildAndDeployment.sourceFiles,
      ...config.other.sourceFiles,
    ] as SourceFile[]

    const uniqueFiles = new Map<string, SourceFile>()
    for (const file of files) {
      uniqueFiles.set(file.relativePath, file)
    }
    return Array.from(uniqueFiles.values())
  }

  private getCollaboratorsByContributor(): Map<string, Array<{ email: string; sharedFiles: number }>> {
    const collaborators = new Map<string, Array<{ email: string; sharedFiles: number }>>()

    const addCollaborator = (contributorEmail: string, collaboratorEmail: string, sharedFiles: number) => {
      const entries = collaborators.get(contributorEmail) ?? []
      entries.push({ email: collaboratorEmail, sharedFiles })
      collaborators.set(contributorEmail, entries)
    }

    for (const dependency of this.analysisResults.contributorsAnalysisResults.peopleDependenciesAllTime) {
      addCollaborator(dependency.fromComponent, dependency.toComponent, dependency.count)
      addCollaborator(dependency.toComponent, dependency.fromComponent, dependency.count)
    }

    for (const [email, entries] of collaborators.entries()) {
      entries.sort((a, b) => b.sharedFiles - a.sharedFiles || a.email.localeCompare(b.email))
      collaborators.set(email, entries)
    }

    return collaborators
  }

  private addFootprintEntry(
    footprint: Map<string, { files: Set<string>; linesOfCode: number }>,
    name: string,
    filePath: string,
    linesOfCode: number,
  ): void {
    if (!name) return
    const entry = footprint.get(name) ?? { files: new Set<string>(), linesOfCode: 0 }
    if (!entry.files.has(filePath)) {
      entry.files.add(filePath)
      entry.linesOfCode += linesOfCode
    }
    footprint.set(name, entry)
  }

  private getSortedFootprint(footprint: Map<string, { files: Set<string>; linesOfCode: number }>) {
    return Array.from(footprint.entries())
      .map(([name, info]) => ({
        name,
        files: info.files.size,
        linesOfCode: info.linesOfCode,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }

  private getContributorCommitId(commitId: string, date: string, filePath: string, index: number): string {
    if (commitId) return commitId
    return `${filePath}:${date}:${index}`
  }

  static dependenciesFileNamePrefix(
    fromComponent: string,
    toComponent: string,
    logicalDecompositionName: string,
  ): string {
    const safeName = logicalDecompositionName.replace(/[^a-zA-Z0-9._-]/g, "_")
    let prefix = `dependencies_${safeName}`
    if (fromComponent && toComponent) {
      const safeFrom = fromComponent.replace(/[^a-zA-Z0-9._-]/g, "_")
      const safeTo = toComponent.replace(/[^a-zA-Z0-9._-]/g, "_")
      prefix += `_${safeFrom}_${safeTo}`
    }
    return prefix
  }
}
