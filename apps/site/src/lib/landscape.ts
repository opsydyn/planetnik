import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveDataDir } from "../loaders/planetnik-loader";

export {
	getLandscapeContributorHref,
	getLandscapeRepoKeyFromParam,
	getLandscapeRepoRouteParam,
	getLandscapeRepositoryCommitsHref,
	getLandscapeRepositoryCodeCityHref,
	getLandscapeRepositoryComponentsHref,
	getLandscapeRepositoryContributorHref,
	getLandscapeRepositoryContributorsHref,
	getLandscapeRepositoryControlsHref,
	getLandscapeRepositoryCouplingHref,
	getLandscapeRepositoryDependenciesHref,
	getLandscapeRepositoryDuplicationHref,
	getLandscapeRepositoryFilePageHref,
	getLandscapeRepositoryHotspotsHref,
	getLandscapeRepositoryHref,
	getLandscapeRepositoryImpactHref,
	getLandscapeRepositoryMetricsHref,
	getLandscapeRepositoryPageHref,
	getLandscapeRepositoryUnitPageHref,
	mapLandscapeRepositoryRoute,
} from "./landscapeRoutes";

export function resolveLandscapeAnalysisRoot(
	dataDir = resolveDataDir(),
): string {
	return resolve(dataDir, "../../..");
}

export function resolveLandscapeRepoDataDir(
	repoKey: string,
	dataDir = resolveDataDir(),
): string {
	return join(resolveLandscapeAnalysisRoot(dataDir), repoKey, "data");
}

export function readLandscapeRepoJson<T>(
	repoKey: string,
	fileName: string,
	dataDir = resolveDataDir(),
): T | null {
	const path = join(resolveLandscapeRepoDataDir(repoKey, dataDir), fileName);
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, "utf-8")) as T;
}

export function readLandscapeRepoText(
	repoKey: string,
	fileName: string,
	dataDir = resolveDataDir(),
): string | null {
	const path = join(resolveLandscapeRepoDataDir(repoKey, dataDir), fileName);
	if (!existsSync(path)) return null;
	return readFileSync(path, "utf-8");
}

export function readLandscapeRepoContributorDetailJson<T>(
	repoKey: string,
	email: string,
	dataDir = resolveDataDir(),
): T | null {
	const fileName = `${encodeURIComponent(email)}.json`;
	const path = join(
		resolveLandscapeRepoDataDir(repoKey, dataDir),
		"contributor_details",
		fileName,
	);
	if (!existsSync(path)) return null;
	return JSON.parse(readFileSync(path, "utf-8")) as T;
}
