import type { CodeCityAudienceId } from "./audience.js"

export type CodeCityAudienceSwitchProps = {
  readonly audience: CodeCityAudienceId
  readonly onChange: (audience: CodeCityAudienceId) => void
}

const AUDIENCES: ReadonlyArray<{ readonly id: CodeCityAudienceId; readonly label: string }> = [
  { id: "onboarding", label: "Onboarding" },
  { id: "architecture-review", label: "Architecture Review" },
  { id: "stakeholder", label: "Stakeholder" },
]

export function CodeCityAudienceSwitch({ audience, onChange }: CodeCityAudienceSwitchProps) {
  return (
    <fieldset className="code-city__audience-switch" aria-label="Code City audience">
      {AUDIENCES.map(({ id, label }) => (
        <button key={id} type="button" aria-pressed={audience === id} onClick={() => onChange(id)}>
          {label}
        </button>
      ))}
    </fieldset>
  )
}
