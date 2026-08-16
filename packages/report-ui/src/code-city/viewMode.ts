export type CodeCityViewMode = "map" | "table"

export type CodeCityViewAvailability = {
  readonly denseDataMode: boolean
  readonly rendererUnavailable: boolean
}

export function resolveCodeCityViewMode(
  requestedMode: CodeCityViewMode,
  availability: CodeCityViewAvailability,
): CodeCityViewMode {
  return availability.denseDataMode || availability.rendererUnavailable ? "table" : requestedMode
}
