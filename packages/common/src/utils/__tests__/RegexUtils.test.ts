import { describe, expect, test } from "bun:test";
import { RegexUtils } from "../RegexUtils";

describe("RegexUtils", () => {
	test("matchesEntirely returns true for full match", () => {
		expect(RegexUtils.matchesEntirely(".*\\.java", "Test.java")).toBe(true);
		expect(RegexUtils.matchesEntirely(".*\\.java", "Test.ts")).toBe(false);
	});

	test("matchesEntirely handles invalid regex gracefully", () => {
		expect(RegexUtils.matchesEntirely("[invalid", "test")).toBe(false);
	});

	test("matchesAnyPattern checks against list", () => {
		const patterns = [".*\\.java", ".*\\.ts"];
		expect(RegexUtils.matchesAnyPattern("File.java", patterns)).toBe(true);
		expect(RegexUtils.matchesAnyPattern("File.ts", patterns)).toBe(true);
		expect(RegexUtils.matchesAnyPattern("File.py", patterns)).toBe(false);
	});

	test("doesNotMatchAnyPattern is negation", () => {
		const patterns = [".*\\.java"];
		expect(RegexUtils.doesNotMatchAnyPattern("File.py", patterns)).toBe(true);
		expect(RegexUtils.doesNotMatchAnyPattern("File.java", patterns)).toBe(
			false,
		);
	});

	test("getMatchedRegex returns first match", () => {
		expect(RegexUtils.getMatchedRegex("hello world", "\\w+")).toBe("hello");
		expect(RegexUtils.getMatchedRegex("no match here", "\\d+")).toBe("");
	});

	test("getMatchedRegexesNoLimits returns all matches", () => {
		const matches = RegexUtils.getMatchedRegexesNoLimits("a1 b2 c3", "\\w\\d");
		expect(matches).toEqual(["a1", "b2", "c3"]);
	});

	test("getLastMatchedRegex returns last match", () => {
		expect(RegexUtils.getLastMatchedRegex("a1 b2 c3", "\\w\\d")).toBe("c3");
	});

	test("reset clears pattern cache", () => {
		RegexUtils.matchesEntirely(".*", "test"); // populate cache
		RegexUtils.reset();
		// should still work after reset
		expect(RegexUtils.matchesEntirely(".*", "test")).toBe(true);
	});
});
