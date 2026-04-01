import { describe, expect, test } from "bun:test";
import { AnalysisUtils } from "../AnalysisUtils.js";

describe("AnalysisUtils", () => {
	describe("getMetricId", () => {
		test("uppercases and replaces spaces and hyphens", () => {
			expect(AnalysisUtils.getMetricId("lines of code")).toBe("LINES_OF_CODE");
		});

		test("replaces hyphens with underscores", () => {
			expect(AnalysisUtils.getMetricId("file-size")).toBe("FILE_SIZE");
		});

		test("removes parenthetical content", () => {
			expect(AnalysisUtils.getMetricId("NUMBER_OF_FILES_(main)")).toBe(
				"NUMBER_OF_FILES",
			);
		});

		test("collapses double underscores", () => {
			expect(AnalysisUtils.getMetricId("FOO__BAR___BAZ")).toBe("FOO_BAR_BAZ");
		});

		test("removes trailing underscore", () => {
			expect(AnalysisUtils.getMetricId("FOO_")).toBe("FOO");
		});

		test("handles mixed case input", () => {
			expect(AnalysisUtils.getMetricId("Number Of Files")).toBe(
				"NUMBER_OF_FILES",
			);
		});
	});
});
