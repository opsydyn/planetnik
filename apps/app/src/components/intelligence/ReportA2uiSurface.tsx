import type { A2UIClientEventMessage } from "@copilotkit/a2ui-renderer"
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import "../intelligence-beta/GenUiBetaBoard.css"
import { getRuntimeReportGenUiBetaSurface } from "../../lib/runtime-client.js"
import { navigateToHostedIntelligencePage } from "./navigation.js"
import { ReportA2uiRenderer } from "./ReportA2uiRenderer.js"
import { normalizeReportA2uiAction, type ReportA2uiAction } from "./report-a2ui-adapter.js"
import { useReportA2uiSurfaceState } from "./useReportA2uiSurfaceState.js"

export interface StagedFollowUpAction {
  readonly question: string
  readonly sensitivity: number | null
  readonly includeSecurity: boolean | null
}

interface ReportA2uiSurfaceProps {
  readonly slug: string
  readonly baseHref: string
  readonly title?: ReactNode
  readonly description?: ReactNode
  readonly loadingMessage?: ReactNode
  readonly emptyMessage?: ReactNode
  readonly showLastAction?: boolean
  readonly onStageFollowUp?: (followUp: StagedFollowUpAction) => Promise<void> | void
  readonly stageFollowUpMode?: "manual" | "auto"
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)

    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

function asBoolean(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value
  }

  if (value === "true") {
    return true
  }

  if (value === "false") {
    return false
  }

  return null
}

function parseStagedFollowUpAction(action: ReportA2uiAction | null): StagedFollowUpAction | null {
  if (action?.actionName !== "stage_followup") {
    return null
  }

  const context = asRecord(action.context)
  const question = typeof context?.question === "string" ? context.question.trim() : ""

  if (!question) {
    return null
  }

  return {
    question,
    sensitivity: asNumber(context?.sensitivity),
    includeSecurity: asBoolean(context?.includeSecurity),
  }
}

export default function ReportA2uiSurface({
  slug,
  baseHref,
  title,
  description,
  loadingMessage,
  emptyMessage,
  showLastAction = false,
  onStageFollowUp,
  stageFollowUpMode = "manual",
}: ReportA2uiSurfaceProps) {
  const { lastAction, setLastAction, surfaceModel, loadError, markLoading, storeLoadError, storeSurfaceModel } =
    useReportA2uiSurfaceState(slug)
  const [followUpStatus, setFollowUpStatus] = useState<"idle" | "sending" | "sent">("idle")
  const [followUpError, setFollowUpError] = useState<string | null>(null)

  const stagedFollowUp = useMemo(() => parseStagedFollowUpAction(lastAction), [lastAction])

  useEffect(() => {
    const abortController = new AbortController()

    async function loadSurface() {
      markLoading()

      try {
        const nextSurfaceModel = await getRuntimeReportGenUiBetaSurface(slug, abortController.signal)

        if (!nextSurfaceModel) {
          throw new Error("Surface request returned no data")
        }

        storeSurfaceModel(nextSurfaceModel)
      } catch (error) {
        if (abortController.signal.aborted) {
          return
        }

        storeLoadError(error instanceof Error ? error.message : "Unknown surface fetch error")
      }
    }

    void loadSurface()

    return () => {
      abortController.abort()
    }
  }, [markLoading, slug, storeLoadError, storeSurfaceModel])

  const submitStageFollowUp = useCallback(
    async (followUp: StagedFollowUpAction) => {
      if (!onStageFollowUp) {
        return
      }

      setFollowUpStatus("sending")
      setFollowUpError(null)

      try {
        await onStageFollowUp(followUp)
        setFollowUpStatus("sent")
      } catch (error) {
        setFollowUpStatus("idle")
        setFollowUpError(error instanceof Error ? error.message : "Unable to send the staged follow-up right now")
      }
    },
    [onStageFollowUp],
  )

  const handleAction = useCallback(
    (message: A2UIClientEventMessage) => {
      const action = normalizeReportA2uiAction(message)
      if (!action) return
      setLastAction(action)
      setFollowUpStatus("idle")
      setFollowUpError(null)

      if (action.actionName === "stage_followup") {
        const followUp = parseStagedFollowUpAction(action)

        if (followUp && onStageFollowUp && stageFollowUpMode === "auto") {
          void submitStageFollowUp(followUp)
        }

        return
      }

      if (action.actionName !== "navigate") {
        return
      }

      const path = typeof action.context.path === "string" ? action.context.path : null

      if (path) {
        void navigateToHostedIntelligencePage(baseHref, path)
      }
    },
    [baseHref, onStageFollowUp, setLastAction, stageFollowUpMode, submitStageFollowUp],
  )

  const handleStageFollowUp = useCallback(async () => {
    if (!stagedFollowUp || !onStageFollowUp || followUpStatus === "sending") {
      return
    }

    await submitStageFollowUp(stagedFollowUp)
  }, [followUpStatus, onStageFollowUp, stagedFollowUp, submitStageFollowUp])

  const followUpNote =
    onStageFollowUp && stageFollowUpMode === "auto"
      ? followUpStatus === "sending"
        ? "Emitting this staged prompt into the live chat…"
        : followUpStatus === "sent"
          ? "Emitted into the live chat as a real follow-up."
          : "This staged prompt emits into the live chat automatically here."
      : onStageFollowUp
        ? "This turns the staged prompt into a real chat follow-up."
        : "This staged follow-up becomes sendable when the surface is embedded in the chat."

  return (
    <section className="gen-ui-beta-a2ui-shell">
      {(title || description) && (
        <div className="gen-ui-beta-section-head">
          {title ? <h3>{title}</h3> : null}
          {description ? <p>{description}</p> : null}
        </div>
      )}

      <div className="gen-ui-beta-a2ui-stack">
        {surfaceModel ? (
          <ReportA2uiRenderer surface={surfaceModel} surfaceId={`report-${slug}`} onAction={handleAction} />
        ) : loadError ? (
          <div className="gen-ui-beta-empty">
            Unable to load the runtime investigation surface right now. <strong>{loadError}</strong>
          </div>
        ) : (
          <div className="gen-ui-beta-empty">
            {loadingMessage ?? "Fetching the runtime-rendered investigation surface…"}
          </div>
        )}

        {showLastAction ? (
          lastAction ? (
            <div className="gen-ui-beta-a2ui-action">
              {stagedFollowUp ? (
                <>
                  <p className="gen-ui-beta-card-eyebrow">Latest staged follow-up</p>
                  <div className="gen-ui-beta-followup-card">
                    <p className="gen-ui-beta-followup-question">{stagedFollowUp.question}</p>

                    <dl className="gen-ui-beta-followup-meta">
                      {stagedFollowUp.sensitivity !== null ? (
                        <div>
                          <dt>Sensitivity</dt>
                          <dd>{Math.round(stagedFollowUp.sensitivity)}</dd>
                        </div>
                      ) : null}

                      {stagedFollowUp.includeSecurity !== null ? (
                        <div>
                          <dt>Security signals</dt>
                          <dd>{stagedFollowUp.includeSecurity ? "Included" : "Skipped"}</dd>
                        </div>
                      ) : null}
                    </dl>

                    <p className="gen-ui-beta-followup-source">
                      <strong>{lastAction.actionName}</strong> from <code>{lastAction.sourceComponentId}</code>
                    </p>

                    <div className="gen-ui-beta-followup-actions">
                      {onStageFollowUp && stageFollowUpMode === "manual" ? (
                        <button
                          type="button"
                          className="gen-ui-beta-followup-button"
                          onClick={() => {
                            void handleStageFollowUp()
                          }}
                          disabled={followUpStatus === "sending"}
                        >
                          {followUpStatus === "sending" ? "Sending follow-up…" : "Ask in chat"}
                        </button>
                      ) : null}

                      <p className="gen-ui-beta-followup-note">{followUpNote}</p>
                    </div>

                    {followUpError ? <p className="gen-ui-beta-followup-error">{followUpError}</p> : null}
                  </div>
                </>
              ) : (
                <>
                  <p className="gen-ui-beta-card-eyebrow">Latest A2UI action</p>
                  <p>
                    <strong>{lastAction.actionName}</strong> from <code>{lastAction.sourceComponentId}</code>
                  </p>
                  <pre>{JSON.stringify(lastAction.context, null, 2)}</pre>
                </>
              )}
            </div>
          ) : (
            <div className="gen-ui-beta-empty">
              {emptyMessage ?? "Use the tabs or buttons to inspect the structured surface."}
            </div>
          )
        ) : null}
      </div>
    </section>
  )
}
