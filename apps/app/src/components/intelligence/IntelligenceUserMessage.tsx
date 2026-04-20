import { UserMessage as CopilotUserMessage, type UserMessageProps } from "@copilotkit/react-ui"
import { isA2uiFollowUpMessageName } from "./a2uiFollowUpMessage"

export default function IntelligenceUserMessage(props: UserMessageProps) {
  if (!isA2uiFollowUpMessageName(props.message?.name)) {
    return <CopilotUserMessage {...props} />
  }

  return (
    <div className="planetnik-followup-user-message">
      <div className="planetnik-followup-user-message__meta">
        <span className="planetnik-followup-user-message__badge">Queued follow-up</span>
        <span className="planetnik-followup-user-message__source">from A2UI controls</span>
      </div>
      <CopilotUserMessage {...props} />
    </div>
  )
}
