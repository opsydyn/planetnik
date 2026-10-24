import type { CodeCityViewMode } from "./viewMode.js"

export type CodeCityViewControlsProps = {
  readonly mode: CodeCityViewMode
  readonly mapAvailable: boolean
  readonly onChange: (mode: CodeCityViewMode) => void
  readonly canReset?: boolean
  readonly onReset?: () => void
}

export function CodeCityViewControls({
  mode,
  mapAvailable,
  onChange,
  canReset = true,
  onReset,
}: CodeCityViewControlsProps) {
  return (
    <fieldset className="code-city__view-buttons" aria-label="Code City view">
      <button
        type="button"
        aria-controls="code-city-map"
        aria-pressed={mode === "map"}
        disabled={!mapAvailable}
        onClick={() => onChange("map")}
      >
        Map view
      </button>
      <button
        type="button"
        aria-controls="code-city-fallback"
        aria-pressed={mode === "table"}
        onClick={() => onChange("table")}
      >
        Table view
      </button>
      {onReset ? (
        <button
          type="button"
          aria-controls="code-city-map"
          aria-keyshortcuts="Home"
          disabled={!canReset}
          title="Reset the camera to the overview (Home)"
          onClick={onReset}
        >
          Reset overview
          {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: kbd has no tabIndex and is not focusable; aria-keyshortcuts announces Home on the button. */}
          <kbd aria-hidden="true">Home</kbd>
        </button>
      ) : null}
    </fieldset>
  )
}
