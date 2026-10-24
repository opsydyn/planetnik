import { navigate } from "astro:transitions/client"
import { useCopilotAction } from "@copilotkit/react-core"

const PAGES = [
  {
    path: "/",
    label: "Dashboard",
    description: "Project summary, language mix, headline metrics",
  },
  {
    path: "/overview",
    label: "Source Code Overview",
    description: "Main vs test code shape and extension breakdown",
  },
  {
    path: "/metrics",
    label: "Metrics",
    description: "Raw metric inventory and numeric summaries",
  },
  {
    path: "/components",
    label: "Components",
    description: "Logical component size and knowledge coverage",
  },
  {
    path: "/coupling",
    label: "Balanced Coupling",
    description: "Coupling pressure and Big Ball of Mud view",
  },
  {
    path: "/dependencies",
    label: "Dependencies",
    description: "Static component dependency relationships",
  },
  {
    path: "/duplication",
    label: "Duplication",
    description: "Duplicate blocks and repeated code signals",
  },
  {
    path: "/files/size",
    label: "File Size",
    description: "Large files by lines of code",
  },
  {
    path: "/files/age",
    label: "File Age",
    description: "File age and legacy concentration",
  },
  {
    path: "/files/churn",
    label: "File Churn",
    description: "Frequently changed files and volatility",
  },
  {
    path: "/files/temporal",
    label: "Temporal Dependencies",
    description: "Files that move together over time",
  },
  {
    path: "/units/size",
    label: "Unit Size",
    description: "Large functions and methods",
  },
  {
    path: "/units/complexity",
    label: "Conditional Complexity",
    description: "High McCabe complexity units",
  },
  {
    path: "/contributors",
    label: "Contributors",
    description: "Contributor activity, ownership, knowledge spread",
  },
  {
    path: "/commits",
    label: "Commits",
    description: "Commit trends and extension-level change",
  },
  {
    path: "/topology",
    label: "Team Topology",
    description: "Contributor collaboration topology",
  },
  {
    path: "/hotspots",
    label: "Hotspots",
    description: "Ranked queue of risky files, units, and components",
  },
  {
    path: "/impact",
    label: "Impact",
    description: "Visible activity versus structural impact",
  },
  {
    path: "/concerns",
    label: "Features of Interest",
    description: "Cross-cutting feature detection",
  },
  {
    path: "/findings",
    label: "Findings",
    description: "Configured findings, when exported",
  },
  {
    path: "/controls",
    label: "Goals & Controls",
    description: "Quality controls and goal coverage",
  },
  {
    path: "/trends",
    label: "Trends",
    description: "Movement of structural signals over time",
  },
  {
    path: "/landscape",
    label: "Landscape Dashboard",
    description: "Organisation-wide summary",
  },
  {
    path: "/landscape/repositories",
    label: "Repositories",
    description: "All repositories with size and activity",
  },
  {
    path: "/landscape/contributors",
    label: "Landscape Contributors",
    description: "Cross-repo contributor activity",
  },
  {
    path: "/landscape/teams",
    label: "Teams",
    description: "Team membership and repository coverage",
  },
  {
    path: "/landscape/topology",
    label: "Landscape Topology",
    description: "Cross-repo collaboration topology",
  },
  {
    path: "/landscape/tags",
    label: "Tags",
    description: "Repository tags and classification",
  },
  {
    path: "/guide",
    label: "Guide",
    description: "Tutorials, how-to guides, and reference",
  },
  {
    path: "/about",
    label: "About",
    description: "Płanetnik philosophy and weather metaphor",
  },
  {
    path: "/technology",
    label: "Technology",
    description: "Technology stack and approach",
  },
]

const PAGE_LIST_FOR_PROMPT = PAGES.map((p) => `"${p.path}" - ${p.label}: ${p.description}`).join("\n")

export function useNavigationAction(basePath: string) {
  useCopilotAction({
    name: "navigateToPage",
    description: `Navigate the user to a specific report page. Use when the user asks to see a report, or when you recommend they look at specific data. Always explain briefly why you are navigating them there.\n\nAvailable pages:\n${PAGE_LIST_FOR_PROMPT}`,
    parameters: [
      {
        name: "path",
        type: "string" as const,
        description: "The page path to navigate to, e.g. '/hotspots' or '/landscape/contributors'",
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
      const fullPath = `${basePath}${path}`
      await navigate(fullPath)
    },
    render: ({ args, status }) => {
      if (!args.path) return <div className="copilot-chart-status">Preparing navigation...</div>
      const page = PAGES.find((p) => p.path === args.path)
      const label = page?.label ?? args.path
      if (status === "complete") {
        return (
          <div className="copilot-nav-action copilot-nav-action--done">
            <span className="copilot-nav-icon">→</span>
            <span>
              Navigated to <strong>{label}</strong>
            </span>
          </div>
        )
      }
      return (
        <div className="copilot-nav-action">
          <span className="copilot-nav-icon">→</span>
          <a href={`${basePath}${args.path}`} className="copilot-nav-link">
            {label}
          </a>
          {args.reason && <span className="copilot-nav-reason">{args.reason}</span>}
        </div>
      )
    },
  })
}
