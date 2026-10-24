import { useAtom } from "@effect/atom-react"
import { Atom } from "effect/reactivity"
import { useCallback, useMemo, useState } from "react"
import type { RuntimeReportGenUiBetaSurface } from "../../lib/runtime-client.js"
import type { ReportA2uiAction } from "./report-a2ui-adapter.js"

type ReportA2uiSurfaceResourceState = {
  readonly surfaceModel: RuntimeReportGenUiBetaSurface | null
  readonly loadError: string | null
  readonly isLoading: boolean
}

const createIdleReportA2uiSurfaceResourceState = (): ReportA2uiSurfaceResourceState => ({
  surfaceModel: null,
  loadError: null,
  isLoading: false,
})

const reportA2uiSurfaceResourcesAtom = Atom.make<Record<string, ReportA2uiSurfaceResourceState>>({})

function updateSurfaceResourceState(
  current: Record<string, ReportA2uiSurfaceResourceState>,
  slug: string,
  updater: (state: ReportA2uiSurfaceResourceState) => ReportA2uiSurfaceResourceState,
) {
  const currentState = current[slug] ?? createIdleReportA2uiSurfaceResourceState()
  const nextState = updater(currentState)

  if (
    currentState.surfaceModel === nextState.surfaceModel &&
    currentState.loadError === nextState.loadError &&
    currentState.isLoading === nextState.isLoading
  ) {
    return current
  }

  return {
    ...current,
    [slug]: nextState,
  }
}

export function useReportA2uiSurfaceState(slug: string) {
  const [resourceStates, setResourceStates] = useAtom(reportA2uiSurfaceResourcesAtom)
  const [lastAction, setLastAction] = useState<ReportA2uiAction | null>(null)

  const resourceState = useMemo(
    () => resourceStates[slug] ?? createIdleReportA2uiSurfaceResourceState(),
    [resourceStates, slug],
  )

  const markLoading = useCallback(() => {
    setLastAction(null)
    setResourceStates((current) =>
      updateSurfaceResourceState(current, slug, (state) => ({
        surfaceModel: state.surfaceModel,
        loadError: null,
        isLoading: true,
      })),
    )
  }, [setResourceStates, slug])

  const storeSurfaceModel = useCallback(
    (surfaceModel: RuntimeReportGenUiBetaSurface) => {
      setResourceStates((current) =>
        updateSurfaceResourceState(current, slug, () => ({
          surfaceModel,
          loadError: null,
          isLoading: false,
        })),
      )
    },
    [setResourceStates, slug],
  )

  const storeLoadError = useCallback(
    (loadError: string) => {
      setResourceStates((current) =>
        updateSurfaceResourceState(current, slug, (state) => ({
          surfaceModel: state.surfaceModel,
          loadError,
          isLoading: false,
        })),
      )
    },
    [setResourceStates, slug],
  )

  return {
    lastAction,
    setLastAction,
    surfaceModel: resourceState.surfaceModel,
    loadError: resourceState.loadError,
    isLoading: resourceState.isLoading,
    markLoading,
    storeSurfaceModel,
    storeLoadError,
  }
}
