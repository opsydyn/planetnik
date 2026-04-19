import { navigate } from "astro:transitions/client"

export function buildHostedIntelligenceHref(baseHref: string, path: string) {
  return `${baseHref}${path}`
}

export async function navigateToHostedIntelligencePage(baseHref: string, path: string) {
  const href = buildHostedIntelligenceHref(baseHref, path)

  try {
    await navigate(href)
  } catch {
    if (typeof window !== "undefined") {
      window.location.assign(href)
      return
    }

    throw new Error(`Unable to navigate to ${href}`)
  }
}
