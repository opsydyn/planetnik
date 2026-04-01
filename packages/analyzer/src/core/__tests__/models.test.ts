import { describe, expect, test } from "bun:test";
import { Schema } from "@effect/schema";
import {
	CodeAnalyzerSettings,
	Link,
	Metadata,
	Range,
	SourceFileFilter,
	TagRule,
} from "../index.js";

describe("SourceFileFilter", () => {
	test("matches path pattern", () => {
		const filter = SourceFileFilter.make({
			pathPattern: ".*\\.java",
			contentPattern: "",
		});
		expect(SourceFileFilter.pathMatches(filter, "src/Main.java")).toBe(true);
		expect(SourceFileFilter.pathMatches(filter, "src/Main.ts")).toBe(false);
	});

	test("exception flag defaults to false", () => {
		const filter = SourceFileFilter.make({
			pathPattern: "",
			contentPattern: "",
		});
		expect(filter.exception).toBe(false);
	});

	test("roundtrips through JSON", () => {
		const filter = SourceFileFilter.make({
			pathPattern: ".*test.*",
			contentPattern: "TODO",
		});
		const json = JSON.parse(JSON.stringify(filter));
		const decoded = Schema.decodeUnknownSync(SourceFileFilter.schema)(json);
		expect(decoded.pathPattern).toBe(".*test.*");
		expect(decoded.contentPattern).toBe("TODO");
	});
});

describe("Link", () => {
	test("creates with label and href", () => {
		const link = Link.make({ label: "Repo", href: "https://github.com" });
		expect(link.label).toBe("Repo");
		expect(link.href).toBe("https://github.com");
	});
});

describe("Metadata", () => {
	test("has sensible defaults", () => {
		const meta = Metadata.make({});
		expect(meta.name).toBe("");
		expect(meta.description).toBe("");
		expect(meta.links).toEqual([]);
	});
});

describe("Range", () => {
	test("isInRange checks bounds", () => {
		const range = Range.make({ min: "0", max: "100" });
		expect(Range.isInRange(range, 50)).toBe(true);
		expect(Range.isInRange(range, 100)).toBe(true);
		expect(Range.isInRange(range, 101)).toBe(false);
		expect(Range.isInRange(range, -1)).toBe(false);
	});

	test("isInRangeWithTolerance applies tolerance", () => {
		const range = Range.make({ min: "0", max: "100", tolerance: "10" });
		expect(Range.isInRangeWithTolerance(range, 105)).toBe(true);
		expect(Range.isInRangeWithTolerance(range, 111)).toBe(false);
	});

	test("getTextDescription formats range", () => {
		const range = Range.make({ min: "0", max: "100", tolerance: "10" });
		expect(Range.getTextDescription(range)).toBe("[0 - 100] ±10");
	});
});

describe("TagRule", () => {
	test("creates with tag and color", () => {
		const rule = TagRule.make({
			tag: "java",
			color: "#345386",
			pathPatterns: [".*\\.java"],
		});
		expect(rule.tag).toBe("java");
		expect(rule.color).toBe("#345386");
	});
});

describe("CodeAnalyzerSettings", () => {
	test("defaults all to true", () => {
		const settings = CodeAnalyzerSettings.make({});
		expect(settings.analyzeDuplication).toBe(true);
		expect(settings.analyzeFileSize).toBe(true);
		expect(settings.analyzeUnitSize).toBe(true);
	});

	test("selectAll enables everything", () => {
		const settings = CodeAnalyzerSettings.selectAll();
		expect(settings.analyzeDuplication).toBe(true);
		expect(settings.analyzeControls).toBe(true);
	});

	test("deselectAll disables everything", () => {
		const settings = CodeAnalyzerSettings.deselectAll();
		expect(settings.analyzeDuplication).toBe(false);
		expect(settings.analyzeControls).toBe(false);
	});
});
