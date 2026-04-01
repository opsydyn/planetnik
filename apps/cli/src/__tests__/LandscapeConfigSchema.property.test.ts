import { describe, expect, test } from "bun:test";
import { Arbitrary, Schema } from "@effect/schema";
import { FastCheck } from "effect";
import { LandscapeConfigSchema } from "../schemas/LandscapeConfigSchema.js";

const decode = Schema.decodeUnknownSync(LandscapeConfigSchema);
const encode = Schema.encodeSync(LandscapeConfigSchema);
const configArbitrary = Arbitrary.make(LandscapeConfigSchema);

describe("LandscapeConfigSchema — properties", () => {
	test("any generated config roundtrips through encode → decode", () => {
		FastCheck.assert(
			FastCheck.property(configArbitrary, (config) => {
				const encoded = encode(config);
				const decoded = decode(encoded);
				expect(decoded.githubOrgs).toEqual(config.githubOrgs);
				expect(decoded.githubCloneUrl).toBe(config.githubCloneUrl);
				expect(decoded.githubApiUrl).toBe(config.githubApiUrl);
				expect(decoded.reposUpdatedAfter).toBe(config.reposUpdatedAfter);
				expect(decoded.commitsMaxYears).toBe(config.commitsMaxYears);
			}),
			{ numRuns: 50 },
		);
	});

	test("githubOrgs is always preserved through decode", () => {
		const orgArb = FastCheck.array(
			FastCheck.string({ minLength: 1, maxLength: 30 }),
			{ minLength: 1, maxLength: 5 },
		);

		FastCheck.assert(
			FastCheck.property(orgArb, (orgs) => {
				const result = decode({ githubOrgs: orgs });
				expect(result.githubOrgs).toEqual(orgs);
			}),
			{ numRuns: 50 },
		);
	});

	test("optional fields always get defaults when omitted", () => {
		const orgArb = FastCheck.array(
			FastCheck.string({ minLength: 1, maxLength: 20 }),
			{ minLength: 1, maxLength: 3 },
		);

		FastCheck.assert(
			FastCheck.property(orgArb, (orgs) => {
				const result = decode({ githubOrgs: orgs });
				expect(typeof result.githubCloneUrl).toBe("string");
				expect(typeof result.githubApiUrl).toBe("string");
				expect(typeof result.reposUpdatedAfter).toBe("string");
				expect(Array.isArray(result.ignore)).toBe(true);
				expect(Array.isArray(result.mergeExtensions)).toBe(true);
				expect(Array.isArray(result.tagGroups)).toBe(true);
				expect(typeof result.commitsMaxYears).toBe("number");
			}),
			{ numRuns: 30 },
		);
	});

	test("ignore rules always have org and repo as strings", () => {
		const ignoreArb = FastCheck.array(
			FastCheck.record({
				org: FastCheck.string({ maxLength: 20 }),
				repo: FastCheck.string({ maxLength: 20 }),
			}),
			{ minLength: 1, maxLength: 5 },
		);

		FastCheck.assert(
			FastCheck.property(ignoreArb, (rules) => {
				const result = decode({ githubOrgs: ["org"], ignore: rules });
				for (const rule of result.ignore) {
					expect(typeof rule.org).toBe("string");
					expect(typeof rule.repo).toBe("string");
				}
			}),
			{ numRuns: 30 },
		);
	});

	test("numeric thresholds are always finite numbers", () => {
		const numArb = FastCheck.integer({ min: 0, max: 10000 });

		FastCheck.assert(
			FastCheck.property(
				numArb,
				numArb,
				numArb,
				(extThreshold, repoThreshold, maxYears) => {
					const result = decode({
						githubOrgs: ["org"],
						extensionThresholdLoc: extThreshold,
						repositoryThresholdLocMain: repoThreshold,
						commitsMaxYears: maxYears,
					});
					expect(Number.isFinite(result.extensionThresholdLoc)).toBe(true);
					expect(Number.isFinite(result.repositoryThresholdLocMain)).toBe(true);
					expect(Number.isFinite(result.commitsMaxYears)).toBe(true);
				},
			),
			{ numRuns: 30 },
		);
	});

	test("mergeExtensions always preserve primary and secondary", () => {
		const extArb = FastCheck.array(
			FastCheck.record({
				primary: FastCheck.string({ minLength: 1, maxLength: 10 }),
				secondary: FastCheck.string({ minLength: 1, maxLength: 10 }),
			}),
			{ maxLength: 5 },
		);

		FastCheck.assert(
			FastCheck.property(extArb, (extensions) => {
				const result = decode({
					githubOrgs: ["org"],
					mergeExtensions: extensions,
				});
				expect(result.mergeExtensions).toHaveLength(extensions.length);
				for (let i = 0; i < extensions.length; i++) {
					expect(result.mergeExtensions[i]!.primary).toBe(
						extensions[i]!.primary,
					);
					expect(result.mergeExtensions[i]!.secondary).toBe(
						extensions[i]!.secondary,
					);
				}
			}),
			{ numRuns: 30 },
		);
	});
});
