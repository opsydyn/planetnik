import type { RuntimeReportDetail } from "./runtime-client.js"
import {
  getHostedReportRepositoriesHref,
  getHostedReportRepositoryHref,
  getHostedReportRepositoryPageHref,
} from "./hosted-routes.js"

export type HostedNavItem = {
  readonly href: string
  readonly label: string
}

export type HostedNavSection = {
  readonly label: string
  readonly items: ReadonlyArray<HostedNavItem>
}

export type HostedBreadcrumb = {
  readonly label: string
  readonly href?: string
}

export type HostedBrandModel = {
  readonly href: string
  readonly variant: "sidebar" | "topbar"
  readonly kicker: string
  readonly title: string
  readonly subtitle: string | null
}

export type HostedShellContext =
  | {
      readonly kind: "public"
    }
  | {
      readonly kind: "dashboard"
    }
  | {
      readonly kind: "report"
      readonly reportSlug: string
      readonly reportTitle: string
      readonly reportMode: "single_repository" | "landscape"
    }
  | {
      readonly kind: "repository"
      readonly reportSlug: string
      readonly reportTitle: string
      readonly reportMode: "landscape"
      readonly repoKey: string
      readonly repoName: string
    }

export type HostedShellModel = {
  readonly chrome: "public" | "application"
  readonly brand: HostedBrandModel
  readonly navSections: ReadonlyArray<HostedNavSection>
  readonly breadcrumbs: ReadonlyArray<HostedBreadcrumb>
  readonly scopeLabel: string | null
  readonly sessionLabel: string
  readonly pageTitle: string
  readonly subtitle: string
}

type BuildHostedShellModelInput = {
  readonly title: string
  readonly subtitle: string
  readonly currentPath: string
  readonly userEmail: string | null
  readonly context?: HostedShellContext
}

type RepositoryScope = {
  readonly repoKey: string
  readonly name: string
}

export function buildHostedBrandModel(input: {
  readonly href: string
  readonly variant: "sidebar" | "topbar"
  readonly subtitle?: string
}): HostedBrandModel {
  return {
    href: input.href,
    variant: input.variant,
    kicker: "Planetnik",
    title: "Planetnik",
    subtitle: input.subtitle ?? null,
  }
}

export function buildHostedReportShellContext(reportDetail: RuntimeReportDetail): HostedShellContext {
  return {
    kind: "report",
    reportSlug: reportDetail.report.slug,
    reportTitle: reportDetail.report.name,
    reportMode: reportDetail.context?.reportMode ?? "single_repository",
  }
}

export function buildHostedRepositoryShellContext(
  reportDetail: RuntimeReportDetail,
  repository: RepositoryScope,
): HostedShellContext {
  return {
    kind: "repository",
    reportSlug: reportDetail.report.slug,
    reportTitle: reportDetail.report.name,
    reportMode: "landscape",
    repoKey: repository.repoKey,
    repoName: repository.name,
  }
}

export function isHostedNavItemActive(currentPath: string, href: string): boolean {
  if (href === "/") {
    return currentPath === href
  }

  if (currentPath === href) {
    return true
  }

  return currentPath.startsWith(`${href}/`)
}

export function buildHostedShellModel(input: BuildHostedShellModelInput): HostedShellModel {
  const context = input.context ?? ({ kind: "public" } satisfies HostedShellContext)
  const sessionLabel = input.userEmail ? `Session: ${input.userEmail}` : "Planetnik Portal"

  if (context.kind === "public") {
    return {
      chrome: "public",
      brand: buildHostedBrandModel({
        href: "/sign-in",
        variant: "topbar",
      }),
      navSections: [],
      breadcrumbs: [],
      scopeLabel: null,
      sessionLabel,
      pageTitle: input.title,
      subtitle: input.subtitle,
    }
  }

  if (context.kind === "dashboard") {
    return {
      chrome: "application",
      brand: buildHostedBrandModel({
        href: "/",
        variant: "sidebar",
      }),
      navSections: [
        {
          label: "Workspace",
          items: [{ href: "/", label: "Dashboard" }],
        },
        {
          label: "About",
          items: [
            { href: "/about", label: "About" },
            { href: "/guide", label: "Guide" },
            { href: "/technology", label: "Technology" },
          ],
        },
      ],
      breadcrumbs: [{ label: "Home" }, { label: input.title }],
      scopeLabel: "Hosted workspace",
      sessionLabel,
      pageTitle: input.title,
      subtitle: input.subtitle,
    }
  }

  if (context.kind === "report") {
    const isLandscapeReport = context.reportMode === "landscape"
    return {
      chrome: "application",
      brand: buildHostedBrandModel({
        href: "/",
        variant: "sidebar",
      }),
      navSections: buildReportNavSections(context),
      breadcrumbs: isLandscapeReport
        ? [
            {
              label: "Landscape",
              href: `/reports/${context.reportSlug}/overview`,
            },
            { label: input.title },
          ]
        : [
            { label: "Home", href: "/" },
            {
              label: context.reportTitle,
              href: `/reports/${context.reportSlug}/overview`,
            },
            { label: input.title },
          ],
      scopeLabel: isLandscapeReport ? `Landscape for ${context.reportTitle}` : `Report for ${context.reportTitle}`,
      sessionLabel,
      pageTitle: input.title,
      subtitle: input.subtitle,
    }
  }

  return {
    chrome: "application",
    brand: buildHostedBrandModel({
      href: "/",
      variant: "sidebar",
    }),
    navSections: buildRepositoryNavSections(context),
    breadcrumbs: [
      {
        label: "Landscape",
        href: `/reports/${context.reportSlug}/overview`,
      },
      {
        label: "Repositories",
        href: getHostedReportRepositoriesHref(context.reportSlug),
      },
      {
        label: context.repoName,
        href: getHostedReportRepositoryHref(context.reportSlug, context.repoKey),
      },
      { label: input.title },
    ],
    scopeLabel: `Landscape for ${context.reportTitle} • ${context.repoName}`,
    sessionLabel,
    pageTitle: input.title,
    subtitle: input.subtitle,
  }
}

export function buildReportNavSections(
  context: Extract<HostedShellContext, { kind: "report" }>,
): ReadonlyArray<HostedNavSection> {
  const baseHref = `/reports/${context.reportSlug}`

  if (context.reportMode === "landscape") {
    return [
      {
        label: "Overview",
        items: [
          { href: `${baseHref}/overview`, label: "Landscape Dashboard" },
          { href: baseHref, label: "Report Details" },
        ],
      },
      {
        label: "Landscape",
        items: [
          { href: `${baseHref}/repositories`, label: "Repositories" },
          { href: `${baseHref}/contributors`, label: "Contributors" },
          { href: `${baseHref}/teams`, label: "Teams" },
          { href: `${baseHref}/topology`, label: "Team Topology" },
          { href: `${baseHref}/tags`, label: "Tags" },
          { href: `${baseHref}/security`, label: "Dependency Security" },
        ],
      },
      {
        label: "Intelligence",
        items: [
          { href: `${baseHref}/intelligence`, label: "Ask Płanetnik" },
          { href: "/coming-soon", label: "Platform" },
        ],
      },
    ]
  }

  const sections: HostedNavSection[] = [
    {
      label: "Overview",
      items: [
        { href: baseHref, label: "Report Details" },
        { href: `${baseHref}/overview`, label: "Overview" },
        { href: `${baseHref}/metrics`, label: "Metrics" },
      ],
    },
    {
      label: "Structure",
      items: [
        { href: `${baseHref}/dependencies`, label: "Dependencies" },
        { href: `${baseHref}/duplication`, label: "Duplication" },
      ],
    },
    {
      label: "Files",
      items: [
        { href: `${baseHref}/files/size`, label: "File Size" },
        { href: `${baseHref}/files/age`, label: "File Age" },
        { href: `${baseHref}/files/churn`, label: "File Churn" },
        { href: `${baseHref}/files/temporal`, label: "Temporal Dependencies" },
      ],
    },
    {
      label: "Units",
      items: [
        { href: `${baseHref}/units/size`, label: "Unit Size" },
        {
          href: `${baseHref}/units/complexity`,
          label: "Conditional Complexity",
        },
      ],
    },
    {
      label: "Team",
      items: [
        { href: `${baseHref}/contributors`, label: "Contributors" },
        { href: `${baseHref}/commits`, label: "Commits" },
        { href: `${baseHref}/topology`, label: "Team Topology" },
      ],
    },
    {
      label: "Quality",
      items: [
        { href: `${baseHref}/hotspots`, label: "Hotspots" },
        { href: `${baseHref}/impact`, label: "Impact" },
        { href: `${baseHref}/controls`, label: "Goals & Controls" },
        { href: `${baseHref}/trends`, label: "Trends" },
      ],
    },
    {
      label: "Intelligence",
      items: [
        { href: `${baseHref}/intelligence`, label: "Ask Płanetnik" },
        { href: "/coming-soon", label: "Platform" },
      ],
    },
  ]

  return sections
}

function buildRepositoryNavSections(
  context: Extract<HostedShellContext, { kind: "repository" }>,
): ReadonlyArray<HostedNavSection> {
  const reportHref = `/reports/${context.reportSlug}`
  const repoHref = getHostedReportRepositoryHref(context.reportSlug, context.repoKey)
  const sections: HostedNavSection[] = [
    {
      label: "Landscape",
      items: [
        { href: `${reportHref}/overview`, label: "Landscape Dashboard" },
        { href: getHostedReportRepositoriesHref(context.reportSlug), label: "Repositories" },
        { href: `${reportHref}/contributors`, label: "Contributors" },
        { href: `${reportHref}/topology`, label: "Team Topology" },
        { href: `${reportHref}/security`, label: "Dependency Security" },
      ],
    },
    {
      label: "Repository",
      items: [
        { href: repoHref, label: `${context.repoName} Dashboard` },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/metrics"),
          label: "Metrics",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/commits"),
          label: "Commits",
        },
      ],
    },
    {
      label: "Structure",
      items: [
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/components"),
          label: "Components",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/coupling"),
          label: "Balanced Coupling",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/dependencies"),
          label: "Dependencies",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/duplication"),
          label: "Duplication",
        },
      ],
    },
    {
      label: "Files",
      items: [
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/files/size"),
          label: "File Size",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/files/age"),
          label: "File Age",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/files/churn"),
          label: "File Churn",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/files/temporal"),
          label: "Temporal Dependencies",
        },
      ],
    },
    {
      label: "Units",
      items: [
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/units/size"),
          label: "Unit Size",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/units/complexity"),
          label: "Conditional Complexity",
        },
      ],
    },
    {
      label: "Team",
      items: [
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/contributors"),
          label: "Contributors",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/topology"),
          label: "Team Topology",
        },
      ],
    },
    {
      label: "Quality",
      items: [
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/impact"),
          label: "Impact",
        },
        {
          href: getHostedReportRepositoryPageHref(context.reportSlug, context.repoKey, "/controls"),
          label: "Goals & Controls",
        },
      ],
    },
    {
      label: "Intelligence",
      items: [{ href: `${reportHref}/intelligence`, label: "Ask Płanetnik" }],
    },
  ]

  return sections
}
