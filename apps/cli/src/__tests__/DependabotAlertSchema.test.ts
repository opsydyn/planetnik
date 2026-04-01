import { describe, expect, test } from "bun:test";
import { Schema } from "@effect/schema";
import { DependabotAlertSchema } from "../schemas/DependabotAlertSchema.js";

const decode = Schema.decodeUnknownSync(DependabotAlertSchema);

const FULL_ALERT = {
	number: 1,
	state: "open",
	dependency: {
		package: { ecosystem: "npm", name: "lodash" },
		manifest_path: "package.json",
		scope: "runtime",
	},
	security_advisory: {
		ghsa_id: "GHSA-xxxx-yyyy-zzzz",
		cve_id: "CVE-2021-23337",
		summary: "Prototype Pollution in lodash",
		severity: "critical",
		published_at: "2021-02-15T00:00:00Z",
	},
	security_vulnerability: {
		severity: "critical",
		vulnerable_version_range: "< 4.17.21",
		first_patched_version: { identifier: "4.17.21" },
	},
	created_at: "2021-03-01T00:00:00Z",
	updated_at: "2021-03-02T00:00:00Z",
	fixed_at: null,
	auto_dismissed_at: null,
};

describe("DependabotAlertSchema", () => {
	test("decodes a full alert", () => {
		const result = decode(FULL_ALERT);
		expect(result.number).toBe(1);
		expect(result.state).toBe("open");
		expect(result.dependency.package.name).toBe("lodash");
		expect(result.security_advisory.severity).toBe("critical");
		expect(
			result.security_vulnerability.first_patched_version!.identifier,
		).toBe("4.17.21");
	});

	test("decodes all valid states", () => {
		for (const state of [
			"open",
			"fixed",
			"dismissed",
			"auto_dismissed",
		] as const) {
			const result = decode({ ...FULL_ALERT, state });
			expect(result.state).toBe(state);
		}
	});

	test("decodes all valid severities", () => {
		for (const severity of ["critical", "high", "medium", "low"] as const) {
			const result = decode({
				...FULL_ALERT,
				security_advisory: { ...FULL_ALERT.security_advisory, severity },
				security_vulnerability: {
					...FULL_ALERT.security_vulnerability,
					severity,
				},
			});
			expect(result.security_advisory.severity).toBe(severity);
		}
	});

	test("handles null cve_id", () => {
		const result = decode({
			...FULL_ALERT,
			security_advisory: { ...FULL_ALERT.security_advisory, cve_id: null },
		});
		expect(result.security_advisory.cve_id).toBeNull();
	});

	test("handles null first_patched_version", () => {
		const result = decode({
			...FULL_ALERT,
			security_vulnerability: {
				...FULL_ALERT.security_vulnerability,
				first_patched_version: null,
			},
		});
		expect(result.security_vulnerability.first_patched_version).toBeNull();
	});

	test("defaults optional fields when omitted", () => {
		const minimal = {
			number: 1,
			state: "open",
			dependency: { package: { ecosystem: "npm", name: "foo" } },
			security_advisory: { ghsa_id: "GHSA-aaaa", severity: "low" },
			security_vulnerability: { severity: "low" },
			created_at: "2024-01-01",
		};
		const result = decode(minimal);
		expect(result.dependency.manifest_path).toBe("");
		expect(result.dependency.scope).toBeNull();
		expect(result.security_advisory.cve_id).toBeNull();
		expect(result.security_advisory.summary).toBe("");
		expect(result.security_vulnerability.vulnerable_version_range).toBe("");
		expect(result.fixed_at).toBeNull();
		expect(result.auto_dismissed_at).toBeNull();
	});

	test("rejects invalid state", () => {
		expect(() => decode({ ...FULL_ALERT, state: "invalid" })).toThrow();
	});

	test("rejects invalid severity", () => {
		expect(() =>
			decode({
				...FULL_ALERT,
				security_advisory: {
					...FULL_ALERT.security_advisory,
					severity: "unknown",
				},
			}),
		).toThrow();
	});

	test("rejects missing required fields", () => {
		expect(() => decode({})).toThrow();
		expect(() => decode({ number: 1 })).toThrow();
	});
});
