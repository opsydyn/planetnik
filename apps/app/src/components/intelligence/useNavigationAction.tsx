import { useCopilotAction } from "@copilotkit/react-core"

interface Page {
  path: string
  label: string
  description: string
  landscapeOnly?: boolean
  singleOnly?: boolean
}

const PAGES: Page[] = [
  { path: "/overview", label: "Landscape Dashboard", description: "Organisation-wide landscape summary", landscapeOnly: true },
  { path: "/repositories", label: "Repositories", description: "All repositories with size and activity", landscapeOnly: true },
  { path: "/contributors", label: "Contributors", description: "Cross-repo contributor activity" },
  { path: "/teams", label: "Teams", description: "Team membership and repository coverage", landscapeOnly: true },
  { path: "/topology", label: "Team Topology", description: "Cross-repo collaboration topology" },
  { path: "/tags", label: "Tags", description: "Repository tags and classification", landscapeOnly: true },
  { path: "/security", label: "Dependency Security", description: "Vulnerability alerts and supply chain risk" },
  { path: "/overview", label: "Overview", description: "Source code shape and extension breakdown", singleOnly: true },
  { path: "/metrics", label: "Metrics", description: "Raw metric inventory and numeric summaries", singleOnly: true },
  { path: "/dependencies", label: "Dependencies", description: "Static component dependency relationships", singleOnly: true },
  { path: "/duplication", label: "Duplication", description: "Duplicate blocks and repeated code signals", singleOnly: true },
  { path: "/files/size", label: "File Size", description: "Large files by lines of code", singleOnly: true },
  { path: "/files/age", label: "File Age", description: "File age and legacy concentration", singleOnly: true },
  { path: "/files/churn", label: "File Churn", description: "Frequently changed files and volatility", singleOnly: true },
  { path: "/files/temporal", label: "Temporal Dependencies", description: "Files that move together over time", singleOnly: true },
  { path: "/units/size", label: "Unit Size", description: "Large functions and methods", singleOnly: true },
  { path: "/units/complexity", label: "Conditional Complexity", description: "High McCabe complexity units", singleOnly: true },
  { path: "/commits", label: "Commits", description: "Commit trends and extension-level change", singleOnly: true },
  { path: "/hotspots", label: "Hotspots", description: "Ranked queue of risky files, units, and components", singleOnly: true },
  { path: "/impact", label: "Impact", description: "Visible activity versus structural impact", singleOnly: true },
  { path: "/controls", label: "Goals & Controls", description: "Quality controls and goal coverage", singleOnly: true },
  { path: "/trends", label: "Trends", description: "Movement of structural signals over time", singleOnly: true },
]

export function useNavigationAction(baseHref: string, isLandscape: boolean) {
  const pages = PAGES.filter((p) =>
    isLandscape ? !p.singleOnly : !p.landscapeOnly,
  )
  const pageListForPrompt = pages
    .map((p) => `"${p.path}" - ${p.label}: ${p.description}`)
    .join("\n")

  useCopilotAction({
    name: "navigateToPage",
    description: `Navigate the user to a specific report page. Use when the user asks to see a report, or when you recommend they look at specific data. Always explain briefly why you are navigating them there.\n\nAvailable pages:\n${pageListForPrompt}`,
    parameters: [
      {
        name: "path",
        type: "string" as const,
        description: "The page path to navigate to, e.g. '/hotspots' or '/contributors'",
        required: true,
      },
      {
        name: "reason",
        type: "string" as const,
        description: "Brief reason for navigating, shown to the user",
        required: true,
      },
    ],
    handler: async ({ path }) => {
      window.location.href = `${baseHref}${path}`
    },
    render: ({ args, status }) => {
      if (!args.path) return <div className="copilot-chart-status">Preparing navigation...</div>
      const page = pages.find((p) => p.path === args.path)
      const label = page?.label ?? args.path
      if (status === "complete") {
        return (
          <div className="copilot-nav-action copilot-nav-action--done">
            <span className="copilot-nav-icon">→</span>
            <span>Navigated to <strong>{label}</strong></span>
          </div>
        )
      }
      return (
        <div className="copilot-nav-action">
          <span className="copilot-nav-icon">→</span>
          <a href={`${baseHref}${args.path}`} className="copilot-nav-link">{label}</a>
          {args.reason && <span className="copilot-nav-reason">{args.reason}</span>}
        </div>
      )
    },
  })
}
