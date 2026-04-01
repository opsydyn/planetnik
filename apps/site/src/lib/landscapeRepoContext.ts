import { getCollection, getEntry } from "astro:content";
import { getLandscapeRepoRouteParam, readLandscapeRepoJson } from "./landscape";

export interface LandscapeRepoPageProps {
	repositoryId: string;
	repoKey: string;
}

export interface RepoAnalysisSummary {
	metadata?: {
		name?: string;
		description?: string;
	};
	duplication?: {
		percentage?: number;
		duplicatedLines?: number;
		cleanedLines?: number;
	};
}

export async function getLandscapeRepositoryStaticPaths() {
	const repositories = await getCollection("landscapeRepositories");

	return repositories.map((repository) => ({
		params: { repo: getLandscapeRepoRouteParam(repository.data.repoKey) },
		props: {
			repositoryId: repository.id,
			repoKey: repository.data.repoKey,
		} satisfies LandscapeRepoPageProps,
	}));
}

export async function getLandscapeRepositoryPageContext(
	props: LandscapeRepoPageProps,
) {
	const reportContext = await getEntry("reportContext", "context");
	const repository = await getEntry(
		"landscapeRepositories",
		props.repositoryId,
	);

	if (!repository) {
		throw new Error(
			`Landscape repository entry not found for ${props.repositoryId}`,
		);
	}

	const repoSummary = readLandscapeRepoJson<RepoAnalysisSummary>(
		props.repoKey,
		"analysisResults.json",
	);
	const projectName = reportContext?.data.title ?? "Planetnik";
	const repoName =
		repository.data.name ||
		repoSummary?.metadata?.name ||
		props.repoKey.split("/").at(-1) ||
		props.repoKey;

	return {
		reportContext,
		repository,
		repoSummary,
		projectName,
		repoName,
	};
}
