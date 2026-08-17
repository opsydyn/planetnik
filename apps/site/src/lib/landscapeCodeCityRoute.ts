import { buildCodeCityModel, CodeCityInputError, type CodeCitySnapshotInput } from "@planetnik/common"
import { type CodeCityRouteResolution, type CodeCityRouteState, resolveCodeCityRouteState } from "@planetnik/report-ui"

export function resolveLandscapeCodeCityRouteState(
  title: string,
  snapshot: CodeCitySnapshotInput | null,
): CodeCityRouteState {
  if (!snapshot) {
    return {
      tag: "invalid",
      message: "Landscape repository Code City could not read a canonical v2 snapshot.",
    }
  }

  let resolution: CodeCityRouteResolution
  try {
    resolution = {
      tag: "model",
      model: buildCodeCityModel(snapshot),
    }
  } catch (error) {
    if (!(error instanceof CodeCityInputError)) throw error
    resolution = { tag: "invalid", message: error.message }
  }

  return resolveCodeCityRouteState({
    title,
    reportMode: snapshot.context.reportMode,
    resolution,
  })
}
