export interface GitHubRepo {
	name: string;
	description: string | null;
	html_url: string;
	clone_url: string;
	size: number;
	archived: boolean;
	language: string | null;
	created_at: string;
	updated_at: string;
	pushed_at: string;
	watchers: number;
}

export interface LandscapeConfig {
	githubApiUrl: string;
	githubCloneUrl: string;
	githubToken?: string | undefined;
	githubOrgs: readonly string[];
	reposUpdatedAfter: string;
	ignore: readonly { readonly org: string; readonly repo: string }[];
}

export async function discoverRepos(
	config: LandscapeConfig,
	signal?: AbortSignal,
): Promise<Map<string, GitHubRepo[]>> {
	const results = new Map<string, GitHubRepo[]>();

	for (const org of config.githubOrgs) {
		const repos = await fetchOrgRepos(org, config, signal);
		const filtered = repos
			.filter((r) => r.language !== null)
			.filter((r) => !r.archived)
			.filter((r) => r.pushed_at >= config.reposUpdatedAfter)
			.filter((r) => !shouldIgnore(org, r.name, config.ignore));

		results.set(org, filtered);
	}

	return results;
}

function githubApiError(response: Response, url: string): Error {
	const rateLimitHint =
		response.headers.get("x-ratelimit-remaining") === "0" || response.headers.has("retry-after")
			? " rate limit exceeded"
			: "";
	return new Error(
		`GitHub API error: ${response.status} ${response.statusText}${rateLimitHint} for ${url}`,
	);
}

async function fetchOrgRepos(
	org: string,
	config: LandscapeConfig,
	signal?: AbortSignal,
): Promise<GitHubRepo[]> {
	const all: GitHubRepo[] = [];
	let page = 1;

	// Try /orgs/ first; if 404, fall back to /users/ (personal accounts like alanpcurrie)
	let prefix = `${config.githubApiUrl}/orgs/${org}`;
	const probeUrl = `${prefix}/repos?per_page=1`;
	const requestInit = (): RequestInit => ({
		headers: {
			"User-Agent": "planetnik",
			...(config.githubToken
				? { Authorization: `token ${config.githubToken}` }
				: {}),
		},
		...(signal === undefined ? {} : { signal }),
	});

	const probe = await fetch(probeUrl, requestInit());

	if (probe.status === 404) {
		prefix = `${config.githubApiUrl}/users/${org}`;
	} else if (!probe.ok) {
		throw githubApiError(probe, probeUrl);
	}

	while (true) {
		const url = `${prefix}/repos?per_page=100&page=${page}`;
		const response = await fetch(url, requestInit());

		if (!response.ok) {
			throw githubApiError(response, url);
		}

		const repos = (await response.json()) as GitHubRepo[];
		if (repos.length === 0) break;

		all.push(...repos);
		page++;
	}

	return all;
}

function shouldIgnore(
	org: string,
	repoName: string,
	rules: readonly { readonly org: string; readonly repo: string }[],
): boolean {
	for (const rule of rules) {
		const orgMatch = rule.org === "" || new RegExp(rule.org, "gi").test(org);
		const repoMatch =
			rule.repo === "" || new RegExp(rule.repo, "gi").test(repoName);
		if (orgMatch && repoMatch) return true;
	}
	return false;
}
