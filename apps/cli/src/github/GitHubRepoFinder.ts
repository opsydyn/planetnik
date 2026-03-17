export interface GitHubRepo {
  name: string
  description: string | null
  html_url: string
  clone_url: string
  size: number
  archived: boolean
  language: string | null
  created_at: string
  updated_at: string
  pushed_at: string
  watchers: number
}

export interface LandscapeConfig {
  githubApiUrl: string
  githubCloneUrl: string
  githubToken: string
  githubOrgs: string[]
  reposUpdatedAfter: string
  ignore: { org: string; repo: string }[]
}

export async function discoverRepos(config: LandscapeConfig): Promise<Map<string, GitHubRepo[]>> {
  const results = new Map<string, GitHubRepo[]>()

  for (const org of config.githubOrgs) {
    const repos = await fetchOrgRepos(org, config)
    const filtered = repos
      .filter((r) => r.language !== null)
      .filter((r) => !r.archived)
      .filter((r) => r.pushed_at >= config.reposUpdatedAfter)
      .filter((r) => !shouldIgnore(org, r.name, config.ignore))

    results.set(org, filtered)
  }

  return results
}

async function fetchOrgRepos(org: string, config: LandscapeConfig): Promise<GitHubRepo[]> {
  const all: GitHubRepo[] = []
  let page = 1

  while (true) {
    const url = `${config.githubApiUrl}/orgs/${org}/repos?per_page=100&page=${page}`
    const response = await fetch(url, {
      headers: {
        "User-Agent": "planetnik",
        Authorization: `token ${config.githubToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText} for ${url}`)
    }

    const repos = (await response.json()) as GitHubRepo[]
    if (repos.length === 0) break

    all.push(...repos)
    page++
  }

  return all
}

function shouldIgnore(org: string, repoName: string, rules: { org: string; repo: string }[]): boolean {
  for (const rule of rules) {
    const orgMatch = rule.org === "" || new RegExp(rule.org, "gi").test(org)
    const repoMatch = rule.repo === "" || new RegExp(rule.repo, "gi").test(repoName)
    if (orgMatch && repoMatch) return true
  }
  return false
}
