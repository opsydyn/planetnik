import { afterEach, describe, expect, test } from "bun:test";
import { CommitInfo } from "../../githistory/CommitInfo.js";
import {
	FileUpdate,
	GitHistoryUtils,
} from "../../githistory/GitHistoryUtils.js";
import { DateUtils, FileHistoryUtils } from "../FileHistoryUtils.js";
import { FileModificationHistory } from "../FileModificationHistory.js";

describe("FileHistoryUtils", () => {
	test("getDateFromString parses yyyy-MM-dd", () => {
		const date = FileHistoryUtils.getDateFromString("2024-03-15");
		expect(date).not.toBeNull();
		expect(date!.getUTCFullYear()).toBe(2024);
		expect(date!.getUTCMonth()).toBe(2); // 0-based
		expect(date!.getUTCDate()).toBe(15);
	});

	test("getDateFromString returns null for invalid input", () => {
		expect(FileHistoryUtils.getDateFromString("")).toBeNull();
		expect(FileHistoryUtils.getDateFromString("abc")).toBeNull();
	});

	test("getDateFromString handles longer strings by taking first 10 chars", () => {
		const date = FileHistoryUtils.getDateFromString("2024-03-15T10:30:00Z");
		expect(date).not.toBeNull();
		expect(date!.getUTCDate()).toBe(15);
	});

	test("daysBetween counts inclusive days", () => {
		const d1 = new Date("2024-01-01T00:00:00Z");
		const d2 = new Date("2024-01-10T00:00:00Z");
		expect(FileHistoryUtils.daysBetween(d1, d2)).toBe(10);
	});
});

describe("DateUtils", () => {
	afterEach(() => {
		DateUtils.reset();
	});

	test("getAnalysisDate respects dateParam override", () => {
		DateUtils.setDateParam("2024-06-15");
		expect(DateUtils.getAnalysisDate()).toBe("2024-06-15");
	});

	test("getAnalysisDate falls back to latestCommitDate", () => {
		DateUtils.setLatestCommitDate("2024-05-20");
		expect(DateUtils.getAnalysisDate()).toBe("2024-05-20");
	});

	test("isDateWithinRange checks day range", () => {
		DateUtils.setDateParam("2024-06-15");
		expect(DateUtils.isDateWithinRange("2024-06-10", 10)).toBe(true);
		expect(DateUtils.isDateWithinRange("2024-06-01", 5)).toBe(false);
	});

	test("isCommittedBetween checks date in range", () => {
		DateUtils.setDateParam("2024-06-15");
		expect(DateUtils.isCommittedBetween("2024-06-10", 3, 7)).toBe(true);
		expect(DateUtils.isCommittedBetween("2024-06-01", 0, 5)).toBe(false);
	});

	test("getWeekMonday finds Monday of week", () => {
		// 2024-06-15 is a Saturday
		expect(DateUtils.getWeekMonday("2024-06-15")).toBe("2024-06-10");
		// 2024-06-10 is already Monday
		expect(DateUtils.getWeekMonday("2024-06-10")).toBe("2024-06-10");
		// 2024-06-16 is Sunday
		expect(DateUtils.getWeekMonday("2024-06-16")).toBe("2024-06-10");
	});

	test("getPastDays returns date strings going back", () => {
		const days = DateUtils.getPastDays(3, "2024-06-15");
		expect(days).toEqual(["2024-06-15", "2024-06-14", "2024-06-13"]);
	});

	test("getPastMonths returns month strings", () => {
		const months = DateUtils.getPastMonths(3, "2024-06-15");
		expect(months).toEqual(["2024-06", "2024-05", "2024-04"]);
	});

	test("getPastYears returns year strings", () => {
		const years = DateUtils.getPastYears(3, "2024-06-15");
		expect(years).toEqual(["2024", "2023", "2022"]);
	});

	test("getMonth extracts yyyy-MM", () => {
		expect(DateUtils.getMonth("2024-06-15")).toBe("2024-06");
	});

	test("getYear extracts yyyy", () => {
		expect(DateUtils.getYear("2024-06-15")).toBe("2024");
	});
});

describe("FileModificationHistory", () => {
	test("sorts dates and returns oldest/latest", () => {
		const history = new FileModificationHistory("test.ts");
		history.dates = ["2024-03-15", "2024-01-10", "2024-06-20"];
		history.commits = [
			new CommitInfo("c1", "2024-03-15", "alice@example.com"),
			new CommitInfo("c2", "2024-01-10", "bob@example.com"),
			new CommitInfo("c3", "2024-06-20", "alice@example.com"),
		];

		expect(history.getOldestDate()).toBe("2024-01-10");
		expect(history.getLatestDate()).toBe("2024-06-20");
		expect(history.getOldestContributor()).toBe("bob@example.com");
		expect(history.getLatestContributor()).toBe("alice@example.com");
	});

	test("countContributors returns unique emails", () => {
		const history = new FileModificationHistory("test.ts");
		history.commits = [
			new CommitInfo("c1", "2024-01-01", "alice@example.com"),
			new CommitInfo("c2", "2024-02-01", "bob@example.com"),
			new CommitInfo("c3", "2024-03-01", "alice@example.com"),
		];

		expect(history.countContributors()).toBe(2);
	});
});

describe("GitHistoryUtils", () => {
	test("parseLine extracts date, email, commitId, path", () => {
		const line = "2024-03-15 alice@example.com abc123def src/main.ts";
		const result = GitHistoryUtils.parseLine(line);
		expect(result).not.toBeNull();
		expect(result!.date).toBe("2024-03-15");
		expect(result!.email).toBe("alice@example.com");
		expect(result!.commitId).toBe("abc123def");
		expect(result!.path).toBe("src/main.ts");
	});

	test("parseLine returns null for short lines", () => {
		expect(GitHistoryUtils.parseLine("")).toBeNull();
		expect(GitHistoryUtils.parseLine("short")).toBeNull();
	});

	test("parseLine filters ignored emails", () => {
		const line = "2024-03-15 bot@ci.example.com abc123 src/main.ts";
		expect(GitHistoryUtils.parseLine(line, ["bot@"])).toBeNull();
	});

	test("shouldIgnore matches regex patterns", () => {
		expect(
			GitHistoryUtils.shouldIgnore("noreply@github.com", ["noreply"]),
		).toBe(true);
		expect(GitHistoryUtils.shouldIgnore("alice@example.com", ["noreply"])).toBe(
			false,
		);
	});

	test("getAuthorCommits deduplicates by commitId", () => {
		const updates = [
			new FileUpdate("2024-01-01", "alice@example.com", "abc", "a.ts"),
			new FileUpdate("2024-01-01", "alice@example.com", "abc", "b.ts"),
			new FileUpdate("2024-01-02", "bob@example.com", "def", "c.ts"),
		];

		const commits = GitHistoryUtils.getAuthorCommits(updates);
		expect(commits).toHaveLength(2);
		expect(commits.find((c) => c.commitId === "abc")!.filesUpdated).toBe(2);
	});

	test("getFileHistories groups commits by path", () => {
		const updates = [
			new FileUpdate("2024-01-01", "alice@example.com", "abc", "a.ts"),
			new FileUpdate("2024-01-02", "bob@example.com", "def", "a.ts"),
			new FileUpdate("2024-01-03", "alice@example.com", "ghi", "b.ts"),
		];

		const histories = GitHistoryUtils.getFileHistories(updates);
		expect(histories.get("a.ts")).toHaveLength(2);
		expect(histories.get("b.ts")).toHaveLength(1);
	});
});
