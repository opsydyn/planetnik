export function getLandscapeRepoKey(analysisResultsPath: string): string {
	const normalizedPath = analysisResultsPath.replace(/\\/g, "/");
	return normalizedPath.replace(/\/data\/analysisResults\.json$/, "");
}
