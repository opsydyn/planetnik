import { describe, expect, test } from "bun:test";
import { Finding } from "../Finding";

describe("Finding", () => {
	test("positive factory creates positive assessment", () => {
		const finding = Finding.positive("Good code coverage");
		expect(finding.assessment).toBe("positive");
		expect(finding.shortDescription).toBe("Good code coverage");
	});

	test("negative factory creates negative assessment", () => {
		const finding = Finding.negative("High duplication");
		expect(finding.assessment).toBe("negative");
		expect(finding.shortDescription).toBe("High duplication");
	});

	test("neutral factory creates neutral assessment", () => {
		const finding = Finding.neutral("Average complexity");
		expect(finding.assessment).toBe("neutral");
	});

	test("withoutOpinion factory creates none assessment", () => {
		const finding = Finding.withoutOpinion("Some observation");
		expect(finding.assessment).toBe("none");
	});

	test("withDetailedDescription returns new Finding with description", () => {
		const finding =
			Finding.positive("Good").withDetailedDescription("Very good indeed");
		expect(finding.detailedDescription).toBe("Very good indeed");
		expect(finding.assessment).toBe("positive");
		expect(finding.shortDescription).toBe("Good");
	});

	test("toString formats with assessment prefix", () => {
		expect(Finding.positive("Good").toString()).toBe("[+] Good");
		expect(Finding.negative("Bad").toString()).toBe("[-] Bad");
		expect(Finding.neutral("Ok").toString()).toBe("[o] Ok");
		expect(Finding.withoutOpinion("Note").toString()).toBe("Note");
	});

	test("defaults are empty strings", () => {
		const finding = Finding.positive("Test");
		expect(finding.detailedDescription).toBe("");
		expect(finding.type).toBe("");
		expect(finding.searchPhrase).toBe("");
	});
});
