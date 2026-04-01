import { describe, expect, test } from "bun:test";
import { FormattingUtils } from "../FormattingUtils";

describe("FormattingUtils", () => {
	test("getFormattedPercentage formats correctly", () => {
		expect(FormattingUtils.getFormattedPercentage(50.5)).toBe("50.5%");
		expect(FormattingUtils.getFormattedPercentage(0)).toBe("0%");
		expect(FormattingUtils.getFormattedPercentage(100)).toBe("100%");
		expect(FormattingUtils.getFormattedPercentage(33.333)).toBe("33.3%");
	});

	test("getFormattedPercentage with custom zero text", () => {
		expect(FormattingUtils.getFormattedPercentage(0, "N/A")).toBe("N/A");
		expect(FormattingUtils.getFormattedPercentage(50.5, "N/A")).toBe("50.5%");
	});

	test("getFormattedRemainderPercentage returns complement", () => {
		expect(FormattingUtils.getFormattedRemainderPercentage(30)).toBe("70%");
		expect(FormattingUtils.getFormattedRemainderPercentage(100)).toBe("0%");
	});

	test("formatCount formats with thousands separator", () => {
		expect(FormattingUtils.formatCount(0)).toBe("0");
		expect(FormattingUtils.formatCount(999)).toBe("999");
		expect(FormattingUtils.formatCount(1000)).toBe("1,000");
		expect(FormattingUtils.formatCount(1234567)).toBe("1,234,567");
	});

	test("formatCount with custom zero text", () => {
		expect(FormattingUtils.formatCount(0, "none")).toBe("none");
		expect(FormattingUtils.formatCount(42, "none")).toBe("42");
	});

	test("formatCountPlural handles singular and plural", () => {
		expect(FormattingUtils.formatCountPlural(1, "file", "files")).toBe(
			"1 file",
		);
		expect(FormattingUtils.formatCountPlural(5, "file", "files")).toBe(
			"5 files",
		);
		expect(FormattingUtils.formatCountPlural(0, "file", "files")).toBe(
			"0 files",
		);
	});

	test("getSmallTextForNumber abbreviates with K and M", () => {
		expect(FormattingUtils.getPlainTextForNumber(500)).toBe("500");
		expect(FormattingUtils.getPlainTextForNumber(1500)).toBe("1.5K");
		expect(FormattingUtils.getPlainTextForNumber(1000000)).toBe("1000K");
	});

	test("formatPeriod converts days to readable period", () => {
		expect(FormattingUtils.formatPeriod(30)).toBe("1 month");
		expect(FormattingUtils.formatPeriod(365)).toBe("1 year");
		expect(FormattingUtils.formatPeriod(400)).toBe("1 year, 1 month");
		expect(FormattingUtils.formatPeriod(0)).toBe("");
	});
});
