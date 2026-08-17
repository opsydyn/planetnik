import { resolveCodeCityAudience, type CodeCityAudienceId } from "./audience.js"
import type { CodeCityStoryStepId } from "./story.js"

export type CodeCityUrlState = {
  readonly audience: CodeCityAudienceId
  readonly story: CodeCityStoryStepId | null
}

const isCodeCityStoryStepId = (value: string | null): value is CodeCityStoryStepId =>
  value === "orient" || value === "name" || value === "connect" || value === "prove"

export function parseCodeCityUrlState(url: URL): CodeCityUrlState {
  const story = url.searchParams.get("story")
  return {
    audience: resolveCodeCityAudience(url.searchParams.get("audience")),
    story: isCodeCityStoryStepId(story) ? story : null,
  }
}

export function resolveCodeCityInitialUrlState(
  initialState: CodeCityUrlState,
  browserUrl: URL | null,
): CodeCityUrlState {
  return browserUrl === null ? initialState : parseCodeCityUrlState(browserUrl)
}

export function buildCodeCityUrl(pathname: string, state: CodeCityUrlState): string {
  const searchParams = new URLSearchParams()
  if (state.audience !== "onboarding") searchParams.set("audience", state.audience)
  if (state.story !== null) searchParams.set("story", state.story)
  const query = searchParams.toString()
  return query ? `${pathname}?${query}` : pathname
}
