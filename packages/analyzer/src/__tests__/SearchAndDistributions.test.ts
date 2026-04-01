import { describe, expect, test } from "bun:test";
import { SourceFile } from "../aspects/SourceFile.js";
import { Thresholds } from "../core/Thresholds.js";
import { DateUtils } from "../filehistory/FileHistoryUtils.js";
import { FileModificationHistory } from "../filehistory/FileModificationHistory.js";
import { TemporalDependenciesHelper } from "../filehistory/TemporalDependenciesHelper.js";
import { CommitsPerExtension } from "../githistory/CommitsPerExtension.js";
import { ContributorPerExtensionStats } from "../githistory/ContributorPerExtensionStats.js";
import { FoundLine } from "../search/FoundLine.js";
import { ReplacePair } from "../search/ReplacePair.js";
import { SearchExpression } from "../search/SearchExpression.js";
import { SearchRequest } from "../search/SearchRequest.js";
import { SearchResult } from "../search/SearchResult.js";
import { SearchResultCleaner } from "../search/SearchResultCleaner.js";
import {
	AgeDistributionType,
	SourceFileAgeDistribution,
} from "../stats/SourceFileAgeDistribution.js";
import { SourceFileChangeDistribution } from "../stats/SourceFileChangeDistribution.js";

describe("SearchExpression", () => {
	test("matches regex pattern", () => {
		const expr = new SearchExpression("hello.*world");
		expect(expr.matches("hello beautiful world")).toBe(true);
		expect(expr.matches("goodbye")).toBe(false);
	});

	test("getMatchedRegex returns match", () => {
		const expr = new SearchExpression("\\d+");
		expect(expr.getMatchedRegex("abc 123 def")).toBe("123");
		expect(expr.getMatchedRegex("no digits")).toBeNull();
	});

	test("handles invalid regex gracefully", () => {
		const expr = new SearchExpression("[invalid");
		expect(expr.matches("test")).toBe(false);
		expect(expr.getMatchedRegex("test")).toBeNull();
	});
});

describe("FoundLine", () => {
	test("toString formats correctly", () => {
		const line = new FoundLine(42, "  import foo  ", "foo");
		expect(line.toString()).toBe("Line 42: import foo");
	});
});

describe("SearchRequest", () => {
	test("has default empty expressions", () => {
		const req = new SearchRequest();
		expect(req.pathSearchExpression.expression).toBe("");
		expect(req.contentSearchExpression.expression).toBe("");
	});
});

describe("SearchResult", () => {
	test("getFoundTextList aggregates matches", () => {
		const req = new SearchRequest();
		const result = new SearchResult(req);
		result.foundFiles.set("file1.ts", {
			filePath: "file1.ts",
			linesWithSearchedContent: [
				new FoundLine(1, "import a", "import"),
				new FoundLine(2, "import b", "import"),
			],
		});
		result.foundFiles.set("file2.ts", {
			filePath: "file2.ts",
			linesWithSearchedContent: [
				new FoundLine(1, "import c", "import"),
				new FoundLine(3, "export d", "export"),
			],
		});

		const textList = result.getFoundTextList();
		expect(textList).toHaveLength(2);
		const importItem = textList.find((t) => t.text === "import");
		expect(importItem!.count).toBe(3);
		const exportItem = textList.find((t) => t.text === "export");
		expect(exportItem!.count).toBe(1);
	});

	test("getTotalNumberOfMatchingLines counts all", () => {
		const req = new SearchRequest();
		const result = new SearchResult(req);
		result.foundFiles.set("file1.ts", {
			filePath: "file1.ts",
			linesWithSearchedContent: [
				new FoundLine(1, "a", "x"),
				new FoundLine(2, "b", "x"),
			],
		});
		expect(result.getTotalNumberOfMatchingLines()).toBe(2);
	});
});

describe("SearchResultCleaner", () => {
	test("cleans text with start/end patterns", () => {
		const cleaner = new SearchResultCleaner();
		cleaner.startCleaningPattern = "import ";
		cleaner.endCleaningPattern = ";";
		expect(cleaner.clean("import foo;")).toBe("foo");
	});

	test("applies replace pairs", () => {
		const cleaner = new SearchResultCleaner();
		cleaner.replacePairs = [new ReplacePair("@company\\.com", "")];
		expect(cleaner.clean("user@company.com")).toBe("user");
	});
});

describe("ReplacePair", () => {
	test("replaces regex match", () => {
		const pair = new ReplacePair("\\d+", "NUM");
		expect(pair.replaceIn("abc 123 def")).toBe("abc NUM def");
	});

	test("handles empty replace gracefully", () => {
		const pair = new ReplacePair("", "something");
		expect(pair.replaceIn("test")).toBe("test");
	});
});

describe("SourceFileAgeDistribution", () => {
	test("distributes files by age", () => {
		DateUtils.setDateParam("2024-06-01");
		const thresholds = new Thresholds(30, 90, 180, 365);
		const dist = new SourceFileAgeDistribution(
			thresholds,
			AgeDistributionType.LAST_MODIFIED,
		);

		const files = [
			createFileWithHistory("a.ts", 100, "2024-05-25"),
			createFileWithHistory("b.ts", 200, "2024-01-01"),
		];

		dist.getOverallLastModifiedDistribution(files);

		expect(dist.getTotalValue()).toBe(300);
		expect(dist.negligibleRiskValue).toBe(100); // 7 days old
		expect(dist.mediumRiskValue).toBe(200); // ~152 days old
		DateUtils.reset();
	});

	test("has age labels with 'days' suffix", () => {
		const thresholds = new Thresholds(30, 90, 180, 365);
		const dist = new SourceFileAgeDistribution(thresholds);
		expect(dist.negligibleRiskLabel).toBe("0-30 days");
		expect(dist.veryHighRiskLabel).toBe("366+ days");
	});

	test("distributes per extension", () => {
		DateUtils.setDateParam("2024-06-01");
		const thresholds = new Thresholds(30, 90, 180, 365);
		const dist = new SourceFileAgeDistribution(
			thresholds,
			AgeDistributionType.LAST_MODIFIED,
		);

		const files = [
			createFileWithHistory("a.ts", 100, "2024-05-25"),
			createFileWithHistory("b.java", 200, "2024-05-20"),
		];

		const perExt = dist.getFileAgeRiskDistributionPerExtension(files);
		expect(perExt).toHaveLength(2);
		expect(perExt.map((d) => d.key).sort()).toEqual(["java", "ts"]);
		DateUtils.reset();
	});
});

describe("SourceFileChangeDistribution", () => {
	test("distributes files by change count", () => {
		const thresholds = new Thresholds(5, 20, 50, 100);
		const dist = new SourceFileChangeDistribution(thresholds);

		const file1 = createFileWithHistory("a.ts", 100, "2024-05-01");
		file1.fileModificationHistory!.dates = [
			"2024-01-01",
			"2024-02-01",
			"2024-03-01",
		]; // 3 changes
		const file2 = createFileWithHistory("b.ts", 200, "2024-01-01");
		file2.fileModificationHistory!.dates = Array.from(
			{ length: 25 },
			(_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`,
		); // 25 changes

		dist.getOverallDistribution([file1, file2]);

		expect(dist.negligibleRiskValue).toBe(100); // 3 changes <= 5
		expect(dist.mediumRiskValue).toBe(200); // 25 changes > 20, <= 50
	});

	test("counts contributors distribution", () => {
		const thresholds = new Thresholds(1, 5, 10, 25);
		const dist = new SourceFileChangeDistribution(thresholds);

		const file1 = createFileWithHistory("a.ts", 100, "2024-05-01");
		file1.fileModificationHistory!.commits = [
			{ date: "2024-01-01", email: "a@test.com", id: "1" },
			{ date: "2024-02-01", email: "b@test.com", id: "2" },
		];

		dist.getOverallContributorsCountDistribution([file1]);
		expect(dist.lowRiskValue).toBe(100); // 2 contributors, > 1 <= 5
	});
});

describe("CommitsPerExtension", () => {
	test("tracks per-extension commit stats", () => {
		const stats = new CommitsPerExtension("ts");
		stats.commitsCount = 42;
		stats.filesCount = 10;
		stats.committers = ["alice", "bob"];
		expect(stats.extension).toBe("ts");
		expect(stats.commitsCount).toBe(42);
		expect(stats.committers).toHaveLength(2);
	});
});

describe("ContributorPerExtensionStats", () => {
	test("tracks contributor file updates", () => {
		const stats = new ContributorPerExtensionStats("alice@test.com");
		stats.fileUpdates = 50;
		stats.fileUpdates30Days = 10;
		stats.fileUpdates90Days = 30;
		expect(stats.contributor).toBe("alice@test.com");
		expect(stats.fileUpdates).toBe(50);
	});
});

describe("TemporalDependenciesHelper", () => {
	test("extractFileDependencies creates dependencies from pairs", () => {
		const helper = new TemporalDependenciesHelper();
		const pairs = [
			{
				sourceFile1Path: "src/a.ts",
				sourceFile2Path: "src/b.ts",
				commitsCountFile1: 5,
				commitsCountFile2: 3,
				commits: ["abc123", "def456"],
				latestCommit: "2024-06-01",
			},
		];

		const deps = helper.extractFileDependencies(pairs);
		expect(deps).toHaveLength(1);
		expect(deps[0]!.fromComponent).toBe("[src/a.ts]");
		expect(deps[0]!.toComponent).toBe("[src/b.ts]");
		expect(deps[0]!.count).toBe(2);
	});

	test("deduplicates bidirectional dependencies", () => {
		const helper = new TemporalDependenciesHelper();
		const pairs = [
			{
				sourceFile1Path: "a.ts",
				sourceFile2Path: "b.ts",
				commitsCountFile1: 1,
				commitsCountFile2: 1,
				commits: ["c1"],
				latestCommit: "",
			},
			{
				sourceFile1Path: "b.ts",
				sourceFile2Path: "a.ts",
				commitsCountFile1: 1,
				commitsCountFile2: 1,
				commits: ["c2"],
				latestCommit: "",
			},
		];

		const deps = helper.extractFileDependencies(pairs);
		expect(deps).toHaveLength(1);
		expect(deps[0]!.count).toBe(2);
	});
});

function createFileWithHistory(
	path: string,
	loc: number,
	lastModifiedDate: string,
): SourceFile {
	const file = new SourceFile(path);
	file.linesOfCode = loc;
	const history = new FileModificationHistory(path);
	history.dates = [lastModifiedDate];
	history.commits = [
		{ date: lastModifiedDate, email: "test@test.com", id: "abc123" },
	];
	file.fileModificationHistory = history;
	return file;
}
