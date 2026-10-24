import {
  A2UIProvider,
  A2UIRenderer,
  type OnActionCallback,
  useA2UIActions,
  useA2UIError,
} from "@copilotkit/a2ui-renderer"
import { useEffect, useState } from "react"
import type { RuntimeReportGenUiBetaSurface } from "../../lib/runtime-client.js"
import { loadReportA2uiSurface } from "./report-a2ui-adapter.js"

interface Props {
  readonly surface: RuntimeReportGenUiBetaSurface
  readonly surfaceId: string
  readonly onAction: OnActionCallback
}

function LoadedSurface({ surface, surfaceId }: Omit<Props, "onAction">) {
  const { clearSurfaces, processMessages } = useA2UIActions()
  const loadError = useA2UIError()
  const [adapterError, setAdapterError] = useState<string | null>(null)

  useEffect(() => {
    setAdapterError(loadReportA2uiSurface(surface, surfaceId, { clearSurfaces, processMessages }))
    return clearSurfaces
  }, [clearSurfaces, processMessages, surface, surfaceId])

  const renderError = adapterError ?? loadError

  return renderError ? (
    <div className="gen-ui-beta-empty">
      Unable to render the investigation surface. <strong>{renderError}</strong>
    </div>
  ) : (
    <A2UIRenderer
      surfaceId={surfaceId}
      fallback={<div className="gen-ui-beta-empty">Preparing the investigation surface…</div>}
    />
  )
}

export function ReportA2uiRenderer({ surface, surfaceId, onAction }: Props) {
  return (
    <div className="gen-ui-beta-a2ui-viewer" style={{ fontFamily: "var(--font-sans, Inter, system-ui, sans-serif)" }}>
      <A2UIProvider key={surfaceId} onAction={onAction}>
        <LoadedSurface surface={surface} surfaceId={surfaceId} />
      </A2UIProvider>
    </div>
  )
}
