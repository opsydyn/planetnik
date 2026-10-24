import type { RuntimeReportSecurity } from "./runtime-client.js"

type ReportSecurityCard = {
  readonly label: string
  readonly value: string
  readonly detail: string | null
}

type ReportSecurityRow = {
  readonly label: string
  readonly value: string
}

export type ReportSecurityViewModel = {
  readonly heading: string
  readonly subtitle: string
  readonly cards: ReadonlyArray<ReportSecurityCard>
  readonly repoRows: ReadonlyArray<ReportSecurityRow>
  readonly packageRows: ReadonlyArray<ReportSecurityRow>
}

function formatCount(value: number): string {
  return value.toLocaleString("en-GB")
}

export function buildReportSecurityViewModel(input: {
  readonly reportName: string
  readonly security: RuntimeReportSecurity
}): ReportSecurityViewModel {
  return {
    heading: input.reportName,
    subtitle: "Dependabot vulnerability health across the linked landscape dataset.",
    cards: [
      {
        label: "Total Alerts",
        value: formatCount(input.security.totalAlerts),
        detail: null,
      },
      {
        label: "Open Alerts",
        value: formatCount(input.security.totalOpenAlerts),
        detail: null,
      },
      {
        label: "Critical",
        value: formatCount(input.security.severityCounts.critical),
        detail: null,
      },
      {
        label: "Repos with Alerts",
        value: `${formatCount(input.security.reposWithAlerts)}/${formatCount(input.security.totalRepos)}`,
        detail: null,
      },
      {
        label: "MTTR",
        value:
          input.security.meanTimeToResolveDays === null
            ? "No data"
            : `${formatCount(input.security.meanTimeToResolveDays)}d`,
        detail: null,
      },
      {
        label: "Exposure",
        value: `${Math.round(input.security.supplyChainExposureScore * 100)}%`,
        detail: null,
      },
    ],
    repoRows: input.security.repoHealth.map((repo) => ({
      label: repo.repo,
      value: `${formatCount(repo.openAlerts)} open · ${formatCount(repo.severityCounts.critical)} critical · ${formatCount(repo.severityCounts.high)} high · MTTR ${repo.meanTimeToResolveDays === null ? "n/a" : `${formatCount(repo.meanTimeToResolveDays)}d`}`,
    })),
    packageRows: input.security.sharedVulnerablePackages.map((pkg) => ({
      label: pkg.name,
      value: `${pkg.ecosystem} · ${pkg.severity} · ${pkg.affectedRepos.join(", ")}`,
    })),
  }
}
