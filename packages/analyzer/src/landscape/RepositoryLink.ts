import { dirname, join } from "node:path";

export class RepositoryLink {
	analysisResultsPath: string = "";
	htmlReportsRoot: string = "";
	note: string = "";

	constructor(analysisResultsPath: string = "") {
		this.analysisResultsPath = analysisResultsPath;
		if (analysisResultsPath) {
			// data/analysisResults.json -> parent is "data", grandparent is repo root
			const reportsRoot = dirname(dirname(analysisResultsPath));
			this.htmlReportsRoot = join(reportsRoot, "html");
		}
	}

	get name(): string {
		// Extract repo name from path: "repoName/data/analysisResults.json" -> "repoName"
		const parts = this.analysisResultsPath.replace(/\\/g, "/").split("/");
		return parts.length >= 3
			? (parts[parts.length - 3] ?? this.analysisResultsPath)
			: this.analysisResultsPath;
	}
}
