import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { Schema } from "@effect/schema";
import { LandscapeConfigSchema } from "../schemas/LandscapeConfigSchema.js";

const decode = Schema.decodeUnknownSync(LandscapeConfigSchema);

describe("LandscapeConfigSchema", () => {
	test("decodes a minimal config with only required fields", () => {
		const result = decode({ githubOrgs: ["effect-TS"] });

		expect(result.githubOrgs).toEqual(["effect-TS"]);
		expect(result.githubCloneUrl).toBe("https://github.com");
		expect(result.githubApiUrl).toBe("https://api.github.com");
		expect(result.reposUpdatedAfter).toBe("2020-01-01");
		expect(result.ignore).toEqual([]);
		expect(result.metadata).toEqual({ name: "", description: "" });
		expect(result.mergeExtensions).toEqual([]);
		expect(result.tagGroups).toEqual([]);
		expect(result.commitsMaxYears).toBe(10);
		expect(result.emitLegacyProjections).toBe(false);
	});

	test("decodes a full config with all fields", () => {
		const input = {
			githubCloneUrl: "https://github.example.com",
			githubApiUrl: "https://api.github.example.com",
			githubToken: "ghp_secret",
			githubOrgs: ["my-org", "other-org"],
			reposUpdatedAfter: "2024-06-01",
			ignore: [{ org: "my-org", repo: "deprecated-.*" }, { repo: "\\.github" }],
			metadata: { name: "My Landscape", description: "Multi-repo analysis" },
			teamsConfig: {
				teams: [{ name: "Platform", emailPatterns: [".*@platform\\.co"] }],
			},
			tagGroups: [
				{
					name: "Domain",
					color: "#8b5cf6",
					repositoryTags: [
						{ tag: "SDK", patterns: [".*-sdk"], anyExtensions: ["ts"] },
					],
				},
			],
			mergeExtensions: [{ primary: "ts", secondary: "tsx" }],
			ignoreContributors: ["bot@ci.local"],
			extensionThresholdLoc: 100,
			commitsMaxYears: 5,
			emitLegacyProjections: true,
		};

		const result = decode(input);

		expect(result.githubCloneUrl).toBe("https://github.example.com");
		expect(result.githubToken).toBe("ghp_secret");
		expect(result.githubOrgs).toEqual(["my-org", "other-org"]);
		expect(result.ignore).toHaveLength(2);
		expect(result.ignore[0]).toEqual({ org: "my-org", repo: "deprecated-.*" });
		expect(result.ignore[1]).toEqual({ org: "", repo: "\\.github" });
		expect(result.metadata.name).toBe("My Landscape");
		expect(result.teamsConfig.teams).toHaveLength(1);
		expect(result.teamsConfig.teams[0]!.name).toBe("Platform");
		expect(result.tagGroups).toHaveLength(1);
		expect(result.tagGroups[0]!.repositoryTags[0]!.tag).toBe("SDK");
		expect(result.mergeExtensions).toEqual([
			{ primary: "ts", secondary: "tsx" },
		]);
		expect(result.ignoreContributors).toEqual(["bot@ci.local"]);
		expect(result.extensionThresholdLoc).toBe(100);
		expect(result.commitsMaxYears).toBe(5);
		expect(result.emitLegacyProjections).toBe(true);
	});

	test("githubToken is optional and defaults to undefined", () => {
		const result = decode({ githubOrgs: ["org"] });
		expect(result.githubToken).toBeUndefined();
	});

	test("rejects missing githubOrgs", () => {
		expect(() => decode({})).toThrow();
	});

	test("rejects invalid githubOrgs type", () => {
		expect(() => decode({ githubOrgs: "not-an-array" })).toThrow();
	});

	test("ignore rules default org and repo to empty string", () => {
		const result = decode({ githubOrgs: ["org"], ignore: [{ bad: true }] });
		expect(result.ignore[0]).toEqual({ org: "", repo: "" });
	});

	test("rejects non-array ignore", () => {
		expect(() =>
			decode({ githubOrgs: ["org"], ignore: "not-array" }),
		).toThrow();
	});

	test("rejects non-object input", () => {
		expect(() => decode("string")).toThrow();
		expect(() => decode(null)).toThrow();
		expect(() => decode(42)).toThrow();
	});

	test("decodes the real landscape-config.json", () => {
		const raw = JSON.parse(readFileSync("./landscape-config.json", "utf-8"));
		const result = decode(raw);

		expect(result.githubOrgs).toContain("alanpcurrie");
		expect(result.githubCloneUrl).toBe("https://github.com");
		expect(result.reposUpdatedAfter).toBe("2024-01-01");
		expect(result.mergeExtensions).toHaveLength(1);
		expect(result.ignore.length).toBeGreaterThan(0);
	});
});
