export interface TemporalDependencyExportInfo {
  periodKey: string
  periodLabel: string
  periodDays: number
  file1: string
  file2: string
  sameCommits: number
  commitsFile1: number
  commitsFile2: number
  latestCommit: string
}

export interface TemporalDependenciesExportInfo {
  title: string
  timestamp: string
  dependencies: TemporalDependencyExportInfo[]
}

export class TemporalDependenciesExporter {
  static exportDependencies(
    periods: Array<{
      key: string
      label: string
      days: number
      pairs: Array<{
        sourceFile1Path: string
        sourceFile2Path: string
        commitsCountFile1: number
        commitsCountFile2: number
        commits: string[]
        latestCommit: string
      }>
    }>,
    title: string,
    timestamp: string,
  ): TemporalDependenciesExportInfo {
    const dependencies = periods.flatMap((period) =>
      period.pairs.map((pair) => ({
        periodKey: period.key,
        periodLabel: period.label,
        periodDays: period.days,
        file1: pair.sourceFile1Path,
        file2: pair.sourceFile2Path,
        sameCommits: pair.commits.length,
        commitsFile1: pair.commitsCountFile1,
        commitsFile2: pair.commitsCountFile2,
        latestCommit: pair.latestCommit,
      })),
    )

    return {
      title,
      timestamp,
      dependencies,
    }
  }
}
