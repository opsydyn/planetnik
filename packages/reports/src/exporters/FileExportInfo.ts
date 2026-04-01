import type { SourceFileType } from "@planetnik/analyzer";

export interface FileExportInfo {
	relativePath: string;
	extension: string;
	linesOfCode: number;
	components: string[];
	concerns: string[];
	commitsCount?: number;
	contributorsCount?: number;
	daysSinceFirstUpdate?: number;
	daysSinceLatestUpdate?: number;
	firstDate?: string;
	latestDate?: string;
	contributors?: string[];
}

export function fileExportInfoFromSourceFile(
	file: SourceFileType,
): FileExportInfo {
	const info: FileExportInfo = {
		relativePath: file.relativePath,
		extension: file.extension,
		linesOfCode: file.linesOfCode,
		components: file.logicalComponents.map((c) => c.name),
		concerns: file.concerns.map((c) => c.name),
	};

	const history = file.fileModificationHistory;
	if (history && history.commits.length > 0) {
		info.commitsCount = history.commits.length;
		info.contributorsCount = history.countContributors();
		info.daysSinceFirstUpdate = history.daysSinceFirstUpdate();
		info.daysSinceLatestUpdate = history.daysSinceLatestUpdate();
		info.firstDate = history.getOldestDate();
		info.latestDate = history.getLatestDate();

		const uniqueEmails = new Set<string>();
		for (const commit of history.commits) {
			if (commit.email) uniqueEmails.add(commit.email);
		}
		info.contributors = Array.from(uniqueEmails).slice(0, 50);
	}

	return info;
}
