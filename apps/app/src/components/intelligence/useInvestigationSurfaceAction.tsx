import { useCopilotAction, useCopilotChatInternal } from "@copilotkit/react-core"
import { A2UI_FOLLOW_UP_MESSAGE_NAME } from "./a2uiFollowUpMessage"
import ReportA2uiSurface, { type StagedFollowUpAction } from "./ReportA2uiSurface"

interface InvestigationSurfaceCardProps {
  readonly slug: string | null
  readonly baseHref: string
  readonly reason?: string
  readonly status: "inProgress" | "executing" | "complete"
}

function buildStagedFollowUpPrompt(followUp: StagedFollowUpAction) {
  const instructions = ["Use the current report context for this follow-up."]

  if (followUp.sensitivity !== null) {
    instructions.push(`Tune the analysis for a sensitivity of ${Math.round(followUp.sensitivity)} out of 100.`)
  }

  if (followUp.includeSecurity !== null) {
    instructions.push(
      followUp.includeSecurity
        ? "Include relevant security signals alongside structural pressure."
        : "Focus on structural signals first and only bring in security if it is essential.",
    )
  }

  return [followUp.question, "", ...instructions.map((instruction) => `- ${instruction}`)].join("\n")
}

function InvestigationSurfaceCard({ slug, baseHref, reason, status }: InvestigationSurfaceCardProps) {
  const { sendMessage, isLoading } = useCopilotChatInternal()

  const handleStageFollowUp = async (followUp: StagedFollowUpAction) => {
    await sendMessage({
      id: crypto.randomUUID(),
      role: "user",
      name: A2UI_FOLLOW_UP_MESSAGE_NAME,
      content: buildStagedFollowUpPrompt(followUp),
    })
  }

  if (!slug) {
    return <div className="copilot-chart-status">Unable to resolve the current report for a structured surface.</div>
  }

  return (
    <div className="copilot-surface">
      <ReportA2uiSurface
        slug={slug}
        baseHref={baseHref}
        title="Structured investigation surface"
        description={
          reason ??
          "A runtime-fetched Planetnik surface for pressure review, signal scanning, and guided next moves without leaving the conversation."
        }
        loadingMessage="Loading the runtime-backed investigation surface..."
        emptyMessage="Use the tabs or buttons to inspect pressure, signals, controls, and next moves in-place."
        showLastAction
        stageFollowUpMode="auto"
        onStageFollowUp={isLoading ? undefined : handleStageFollowUp}
      />
      {status === "executing" && <div className="copilot-chart-streaming">Refining structured surface...</div>}
    </div>
  )
}

function extractReportSlug(baseHref: string) {
  const pathSegments = baseHref.split("/").filter(Boolean)
  const reportsIndex = pathSegments.indexOf("reports")

  if (reportsIndex === -1) {
    return null
  }

  return pathSegments[reportsIndex + 1] ?? null
}

export function useInvestigationSurfaceAction(baseHref: string) {
  const slug = extractReportSlug(baseHref)

  useCopilotAction({
    name: "renderInvestigationSurface",
    description:
      "Render a structured Planetnik investigation surface inside the chat. Use this when the user would benefit from a compact, navigable summary of pressure, signals, controls, and suggested next moves instead of prose alone.",
    parameters: [
      {
        name: "reason",
        type: "string" as const,
        description: "Brief explanation of why this structured surface is being shown",
        required: false,
      },
    ],
    handler: () => {},
    render: ({ args, status }) => (
      <InvestigationSurfaceCard slug={slug} baseHref={baseHref} reason={args.reason} status={status} />
    ),
  })
}
