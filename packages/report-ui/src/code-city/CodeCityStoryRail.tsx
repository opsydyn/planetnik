import type { CodeCityStory, CodeCityStoryEvent, CodeCityStoryState } from "./story.js"

export type CodeCityStoryRailProps = {
  readonly story: CodeCityStory
  readonly state: CodeCityStoryState
  readonly onEvent: (event: CodeCityStoryEvent) => void
  readonly onFocusStep: () => void
}

const activeStep = (story: CodeCityStory, stepIndex: number) =>
  story.steps[Math.min(Math.max(0, stepIndex), story.steps.length - 1)] ?? null

export function CodeCityStoryRail({
  story,
  state,
  onEvent,
  onFocusStep,
}: CodeCityStoryRailProps) {
  if (state.tag === "idle") {
    return (
      <section className="code-city__story-rail" aria-labelledby="code-city-story-title">
        <div>
          <p className="code-city__eyebrow">Guided explanation</p>
          <h2 id="code-city-story-title">Explain this city</h2>
          <p>Take a short, evidence-backed tour without changing the map until you choose to focus.</p>
        </div>
        <button type="button" onClick={() => onEvent({ type: "start" })}>
          Explain this city
        </button>
      </section>
    )
  }

  if (state.tag === "completed") {
    return (
      <section className="code-city__story-rail" aria-labelledby="code-city-story-title">
        <div>
          <p className="code-city__eyebrow">Guided explanation</p>
          <h2 id="code-city-story-title">Story complete</h2>
          <p>The explanation remains grounded in the canonical evidence linked from each step.</p>
        </div>
        <div className="code-city__story-actions" aria-label="Code City story controls">
          <button type="button" onClick={() => onEvent({ type: "start" })}>
            Replay
          </button>
          <button type="button" onClick={() => onEvent({ type: "exit" })}>
            Exit
          </button>
        </div>
      </section>
    )
  }

  const step = activeStep(story, state.stepIndex)
  if (!step) {
    return (
      <section className="code-city__story-rail" aria-labelledby="code-city-story-title">
        <div>
          <p className="code-city__eyebrow">Guided explanation</p>
          <h2 id="code-city-story-title">Explain this city</h2>
          <p>No canonical story steps are available for this snapshot.</p>
        </div>
        <div className="code-city__story-actions" aria-label="Code City story controls">
          <button type="button" disabled>
            Back
          </button>
          <button type="button" disabled>
            Next
          </button>
          <button type="button" disabled>
            Skip
          </button>
          <button type="button" disabled>
            Focus this step
          </button>
          <button type="button" onClick={() => onEvent({ type: "exit" })}>
            Exit
          </button>
        </div>
      </section>
    )
  }

  const isUnavailable = step.availability === "unavailable"
  const canFocus = step.target !== null

  return (
    <section className="code-city__story-rail" aria-labelledby="code-city-story-title">
      <div className="code-city__story-copy">
        <p className="code-city__eyebrow">Guided explanation</p>
        <p className="code-city__story-progress">
          Step {state.stepIndex + 1} of {story.steps.length}
        </p>
        <h2 id="code-city-story-title">{step.title}</h2>
        <p>{step.body}</p>
        {isUnavailable ? (
          <p className="code-city__story-unavailable" role="status">
            Unavailable: {step.unavailableReason ?? "The canonical evidence is unavailable for this step."}
          </p>
        ) : null}
        {step.evidence.length > 0 ? (
          <ul className="code-city__story-evidence" aria-label="Story evidence">
            {step.evidence.map((evidence) => (
              <li key={`${evidence.label}:${evidence.href}`}>
                <a href={evidence.href}>{evidence.label}</a>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="code-city__story-actions" aria-label="Code City story controls">
        <button type="button" disabled={state.stepIndex === 0} onClick={() => onEvent({ type: "back" })}>
          Back
        </button>
        <button type="button" onClick={() => onEvent({ type: "next" })}>
          Next
        </button>
        <button type="button" disabled={!isUnavailable} onClick={() => onEvent({ type: "skip" })}>
          Skip
        </button>
        <button type="button" disabled={!canFocus && !state.focused} onClick={onFocusStep}>
          {state.focused ? "Return to overview" : "Focus this step"}
        </button>
        <button type="button" onClick={() => onEvent({ type: "exit" })}>
          Exit
        </button>
      </div>
    </section>
  )
}

export default CodeCityStoryRail
