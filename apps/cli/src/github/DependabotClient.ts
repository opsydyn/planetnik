import { parseLinkHeader } from "./parseLinkHeader.js"

export interface DependabotAlert {
  number: number
  state: string
  dependency: {
    package: { ecosystem: string; name: string }
    manifest_path: string
    scope: string | null
  }
  security_advisory: {
    ghsa_id: string
    cve_id: string | null
    summary: string
    severity: string
    published_at: string
  }
  security_vulnerability: {
    severity: string
    vulnerable_version_range: string
    first_patched_version: { identifier: string } | null
  }
  created_at: string
  updated_at: string
  fixed_at: string | null
  auto_dismissed_at: string | null
}

/**
 * Fetch Dependabot alerts for a repository using cursor-based pagination.
 *
 * Gracefully returns an empty array on 403 (missing `security_events` scope)
 * or 404 (Dependabot not enabled for the repo).
 */
export async function fetchDependabotAlerts(
  owner: string,
  repo: string,
  token: string | undefined,
  apiUrl: string,
): Promise<DependabotAlert[]> {
  const all: DependabotAlert[] = []
  let url: string | undefined = `${apiUrl}/repos/${owner}/${repo}/dependabot/alerts?per_page=100`

  const headers: Record<string, string> = { "User-Agent": "planetnik" }
  if (token) {
    headers.Authorization = `token ${token}`
  }

  while (url) {
    const response = await fetch(url, { headers })

    if (response.status === 403 || response.status === 404) {
      return all
    }

    if (!response.ok) {
      throw new Error(`Dependabot API error: ${response.status} ${response.statusText} for ${url}`)
    }

    const alerts = (await response.json()) as DependabotAlert[]
    all.push(...alerts)

    const linkHeader = response.headers.get("Link")
    const links = parseLinkHeader(linkHeader)
    url = links.next
  }

  return all
}
