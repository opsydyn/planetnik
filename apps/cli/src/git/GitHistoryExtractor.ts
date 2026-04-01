import { writeFileSync } from "node:fs";
import { join } from "node:path";
import simpleGit from "simple-git";

const GIT_HISTORY_FILE = "git-history.txt";

export async function extractGitHistory(root: string): Promise<number> {
	const git = simpleGit(root);
	const outputPath = join(root, GIT_HISTORY_FILE);

	// Use raw git log with --name-only to get commit metadata + changed files
	// Format: "date email hash authorName" followed by blank line and file names
	// Author name is placed last since it can contain spaces; the 40-char hash anchors parsing
	const raw = await git.raw([
		"log",
		"--name-only",
		"--format=%ad %ae %H %aN",
		"--date=short",
	]);

	const lines: string[] = [];
	let count = 0;

	let currentPrefix = "";
	for (const line of raw.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed) continue;

		// Lines matching "YYYY-MM-DD email hash" are commit headers
		if (/^\d{4}-\d{2}-\d{2} /.test(trimmed)) {
			currentPrefix = trimmed;
		} else if (currentPrefix) {
			// This is a file path belonging to the current commit
			const safePath = trimmed.replace(/ /g, "&nbsp;");
			lines.push(`${currentPrefix}\t${safePath}`);
			count++;
		}
	}

	writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf-8");
	return count;
}
