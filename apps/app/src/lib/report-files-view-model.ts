import type { RuntimeReportFilesView } from "./runtime-client.js"

type ReportFilesCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
}

type ReportFilesRow = {
  readonly label: string
  readonly value: string
}

type ReportFilesSection = {
  readonly title: string
  readonly rows: ReadonlyArray<ReportFilesRow>
}

type ReportFilesLink = {
  readonly label: string
  readonly href: string
  readonly active: boolean
}

export type ReportFilesViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly activeView: RuntimeReportFilesView["view"]
  readonly cards: ReadonlyArray<ReportFilesCard>
  readonly sections: ReadonlyArray<ReportFilesSection>
  readonly viewLinks: ReadonlyArray<ReportFilesLink>
}

const fileViews = [
  { value: "size", label: "Size" },
  { value: "age", label: "Age" },
  { value: "churn", label: "Churn" },
  { value: "temporal", label: "Temporal" },
] as const

function formatCount(value: number): string {
  return value.toLocaleString("en-GB")
}

export function buildReportFilesViewModel(input: {
  readonly reportName: string
  readonly slug: string
  readonly routeBase?: string
  readonly files: RuntimeReportFilesView
}): ReportFilesViewModel {
  const routeBase = input.routeBase ?? `/reports/${input.slug}/files`
  const viewLinks = fileViews.map((view) => ({
    label: view.label,
    href: `${routeBase}/${view.value}`,
    active: view.value === input.files.view,
  }))

  if (input.files.view === "size") {
    return {
      heading: input.reportName,
      subtitle: "Hosted file-level summary from the linked Planetnik dataset.",
      activeView: input.files.view,
      cards: [
        {
          label: "Files",
          value: formatCount(input.files.headline.fileCount),
          detail: null,
        },
        {
          label: "Total LOC",
          value: formatCount(input.files.headline.totalLinesOfCode),
          detail: null,
        },
      ],
      sections: [
        {
          title: "Size distribution",
          rows: input.files.sizeDistribution.map((item) => ({
            label: item.label,
            value: `${formatCount(item.value)} loc · ${item.detail}`,
          })),
        },
        {
          title: "Largest files",
          rows: input.files.largestFiles.map((item) => ({
            label: item.label,
            value: `${formatCount(item.value)} loc`,
          })),
        },
        {
          title: "File inventory",
          rows: input.files.rows.map((row) => ({
            label: row.relativePath,
            value: [
              `.${row.extension}`,
              `${formatCount(row.linesOfCode)} loc`,
              row.commitsCount === null ? null : `${formatCount(row.commitsCount)} commits`,
              row.contributorsCount === null ? null : `${formatCount(row.contributorsCount)} contributors`,
            ]
              .filter((part): part is string => part !== null)
              .join(" · "),
          })),
        },
      ],
      viewLinks,
    }
  }

  if (input.files.view === "age") {
    return {
      heading: input.reportName,
      subtitle: "Hosted file-level summary from the linked Planetnik dataset.",
      activeView: input.files.view,
      cards: [
        {
          label: "Age (Days)",
          value: input.files.headline.ageInDays === null ? "N/A" : formatCount(input.files.headline.ageInDays),
          detail: null,
        },
        {
          label: "Active Days",
          value: input.files.headline.activeDays === null ? "N/A" : formatCount(input.files.headline.activeDays),
          detail: null,
        },
        {
          label: "Weeks",
          value: input.files.headline.weeks === null ? "N/A" : formatCount(input.files.headline.weeks),
          detail: null,
        },
      ],
      sections: [
        {
          title: "Age categories",
          rows: input.files.categories.map((item) => ({
            label: item.label,
            value: `${formatCount(item.value)} files`,
          })),
        },
      ],
      viewLinks,
    }
  }

  if (input.files.view === "churn") {
    return {
      heading: input.reportName,
      subtitle: "Hosted file-level summary from the linked Planetnik dataset.",
      activeView: input.files.view,
      cards: [
        {
          label: "Active Days",
          value: input.files.headline.activeDays === null ? "N/A" : formatCount(input.files.headline.activeDays),
          detail: null,
        },
        {
          label: "Weeks",
          value: input.files.headline.weeks === null ? "N/A" : formatCount(input.files.headline.weeks),
          detail: null,
        },
        {
          label: "Files With History",
          value: formatCount(input.files.headline.filesWithHistoryCount),
          detail: null,
        },
      ],
      sections: [
        {
          title: "Most changed files",
          rows: input.files.mostChangedFiles.map((item) => ({
            label: item.label,
            value: `${formatCount(item.value)} commits`,
          })),
        },
        {
          title: "Churn inventory",
          rows: input.files.rows.map((row) => ({
            label: row.relativePath,
            value: [
              row.commitsCount === null ? null : `${formatCount(row.commitsCount)} commits`,
              row.contributorsCount === null ? null : `${formatCount(row.contributorsCount)} contributors`,
              row.latestDate,
            ]
              .filter((part): part is string => part !== null && part.length > 0)
              .join(" · "),
          })),
        },
      ],
      viewLinks,
    }
  }

  return {
    heading: input.reportName,
    subtitle: "Hosted file-level summary from the linked Planetnik dataset.",
    activeView: input.files.view,
    cards: [
      {
        label: "Periods",
        value: formatCount(input.files.sections.length),
        detail: null,
      },
      {
        label: "Dependencies",
        value: formatCount(input.files.sections.reduce((sum, section) => sum + section.dependencies.length, 0)),
        detail: null,
      },
    ],
    sections: input.files.sections.map((section) => ({
      title: `${section.periodLabel} (${formatCount(section.periodDays)} days)`,
      rows: section.dependencies.map((dependency) => ({
        label: `${dependency.file1} ↔ ${dependency.file2}`,
        value: `${formatCount(dependency.sameCommits)} shared commits · latest ${dependency.latestCommit}`,
      })),
    })),
    viewLinks,
  }
}
