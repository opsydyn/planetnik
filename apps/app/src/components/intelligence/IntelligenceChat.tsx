import { CopilotKit } from "@copilotkit/react-core"
import { CopilotChat } from "@copilotkit/react-ui"
import "@copilotkit/react-ui/styles.css"
import "./IntelligenceChat.css"
import {
  type AnalysisContextProps,
  useAnalysisContext,
} from "./useAnalysisContext"
import { useChartActions } from "./useChartActions"
import { useNavigationAction } from "./useNavigationAction"
import { useSuggestions } from "./useSuggestions"

const PLANETNIK_INSTRUCTIONS = `You are Płanetnik — a weather spirit from Polish folklore who commands storms, shapes winds, and reads the skies. In the codebase, you read structural weather: complexity pressure, coupling storms, knowledge fog, and change turbulence.

Personality:
- You speak with quiet authority, like someone who has watched many codebases grow and decay.
- You use weather and atmospheric metaphors naturally — hotspots are "pressure zones", high coupling is "turbulence", knowledge silos are "fog banks", healthy code is "clear skies".
- You are direct and opinionated. When the data shows a problem, you say so clearly. You do not hedge with "it depends" when the evidence is strong.
- You care about the craft. You want teams to build systems that endure, not just ship features.
- You are concise. You lead with the insight, then support it with data. No filler.
- When generating charts, briefly explain what the visualisation reveals — don't just present raw data.

Tone: Think weathered mentor, not corporate assistant. Warm but no-nonsense. Occasionally dry.`

interface Props extends AnalysisContextProps {
  runtimeUrl: string
  baseHref: string
  isLandscape: boolean
}

interface InnerProps extends AnalysisContextProps {
  baseHref: string
  isLandscape: boolean
}

function IntelligenceChatInner({ baseHref, isLandscape, ...props }: InnerProps) {
  useAnalysisContext(props)
  useChartActions()
  useNavigationAction(baseHref, isLandscape)
  useSuggestions(props)

  return (
    <CopilotChat
      className="planetnik-chat"
      instructions={PLANETNIK_INSTRUCTIONS}
      labels={{
        title: "Płanetnik",
        placeholder: "Ask about your codebase weather...",
        initial:
          "I am Płanetnik. I read the structural weather of your codebase — where pressure builds, where fog gathers, where the skies are clear. Ask me anything about your analysis.",
      }}
    />
  )
}

export default function IntelligenceChat({ runtimeUrl, baseHref, isLandscape, ...dataProps }: Props) {
  if (!runtimeUrl) {
    return (
      <div className="intelligence-unconfigured">
        <p>Intelligence is not configured for this deployment.</p>
        <p>
          Set <code>PUBLIC_COPILOT_RUNTIME_URL</code> to enable AI-powered analysis.
        </p>
      </div>
    )
  }

  return (
    <CopilotKit runtimeUrl={runtimeUrl} showDevConsole={false}>
      <IntelligenceChatInner baseHref={baseHref} isLandscape={isLandscape} {...dataProps} />
    </CopilotKit>
  )
}
