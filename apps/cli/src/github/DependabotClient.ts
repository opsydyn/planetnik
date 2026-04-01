import { parseLinkHeader } from "./parseLinkHeader.js"

export class DependabotAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DependabotAuthError"
  }
}

export class DependabotScopeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "DependabotScopeError"
  }
}

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
 * Returns an empty array on 404 (Dependabot not enabled for the repo).
 * Throws a clear error on 401 (invalid token) or 403 (missing scope / access).
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

    if (response.status === 404) {
      return all
    }

    if (response.status === 401) {
      throw new DependabotAuthError(
        `GitHub token is invalid for Dependabot alerts on ${owner}/${repo}. Check GITHUB_TOKEN.`,
      )
    }

    if (response.status === 403) {
      throw new DependabotScopeError(
        `GitHub token cannot read Dependabot alerts for ${owner}/${repo}. Check security_events scope, SSO authorization, and repo access.`,
      )
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
