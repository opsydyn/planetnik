import { afterEach, describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	getDatasetCandidateDirs,
	isRecognizedDataDir,
	resolveNamedDatasetDataDir,
} from "../dataDirectories";

const tempDirs: string[] = [];

function createTempRoot(): string {
	const root = mkdtempSync(join(tmpdir(), "planetnik-datasets-"));
	tempDirs.push(root);
	return root;
}

function touch(root: string, relativePath: string): void {
	const filePath = join(root, relativePath);
	mkdirSync(join(filePath, ".."), { recursive: true });
	writeFileSync(filePath, "{}", "utf-8");
}

afterEach(() => {
	while (tempDirs.length > 0) {
		const dir = tempDirs.pop();
		if (dir) rmSync(dir, { recursive: true, force: true });
	}
});

describe("dataset directory helpers", () => {
	test("returns the supported dataset candidate paths", () => {
		expect(getDatasetCandidateDirs("/repo/datasets", "effect-ts")).toEqual([
			"/repo/datasets/effect-ts/data",
			"/repo/datasets/effect-ts/reports/data",
			"/repo/datasets/effect-ts/_planetnik/reports/data",
			"/repo/datasets/effect-ts/_planetnik_landscape/reports/data",
		]);
	});

	test("recognizes a data directory from report_context.json", () => {
		const root = createTempRoot();
		touch(
			root,
			"effect-ts/_planetnik_landscape/reports/data/report_context.json",
		);

		expect(
			isRecognizedDataDir(
				join(root, "effect-ts/_planetnik_landscape/reports/data"),
			),
		).toBe(true);
	});

	test("resolves a single-repository dataset by name", () => {
		const root = createTempRoot();
		touch(root, "sokrates/data/analysisResults.json");

		expect(resolveNamedDatasetDataDir("sokrates", root)).toBe(
			join(root, "sokrates/data"),
		);
	});

	test("resolves a landscape dataset by name", () => {
		const root = createTempRoot();
		touch(
			root,
			"effect-ts/_planetnik_landscape/reports/data/report_context.json",
		);

		expect(resolveNamedDatasetDataDir("effect-ts", root)).toBe(
			join(root, "effect-ts/_planetnik_landscape/reports/data"),
		);
	});

	test("returns undefined when no candidate data directory is valid", () => {
		const root = createTempRoot();
		mkdirSync(join(root, "alanpcurrie"), { recursive: true });

		expect(resolveNamedDatasetDataDir("alanpcurrie", root)).toBeUndefined();
	});
});
