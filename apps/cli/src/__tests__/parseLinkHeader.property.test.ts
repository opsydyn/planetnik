import { describe, expect, test } from "bun:test";
import { FastCheck } from "effect";
import { parseLinkHeader } from "../github/parseLinkHeader.js";

const REL_TYPES = ["next", "prev", "first", "last"] as const;

/** Generate a valid GitHub-style Link header from a set of rel→url pairs */
const linkHeaderArb = FastCheck.array(
	FastCheck.record({
		rel: FastCheck.constantFrom(...REL_TYPES),
		path: FastCheck.webPath(),
		query: FastCheck.webQueryParameters(),
	}),
	{ minLength: 1, maxLength: 4 },
).map((entries) => {
	const seen = new Set<string>();
	const unique = entries.filter((e) => {
		if (seen.has(e.rel)) return false;
		seen.add(e.rel);
		return true;
	});
	return {
		entries: unique,
		header: unique
			.map(
				(e) => `<https://api.github.com${e.path}?${e.query}>; rel="${e.rel}"`,
			)
			.join(", "),
	};
});

describe("parseLinkHeader — properties", () => {
	test("every rel in a well-formed header is extracted", () => {
		FastCheck.assert(
			FastCheck.property(linkHeaderArb, ({ entries, header }) => {
				const result = parseLinkHeader(header);
				for (const entry of entries) {
					expect(result[entry.rel]).toBeDefined();
				}
			}),
			{ numRuns: 100 },
		);
	});

	test("extracted URLs always start with https://", () => {
		FastCheck.assert(
			FastCheck.property(linkHeaderArb, ({ header }) => {
				const result = parseLinkHeader(header);
				for (const key of REL_TYPES) {
					if (result[key]) {
						expect(result[key]!.startsWith("https://")).toBe(true);
					}
				}
			}),
			{ numRuns: 100 },
		);
	});

	test("result only contains known rel keys", () => {
		FastCheck.assert(
			FastCheck.property(linkHeaderArb, ({ header }) => {
				const result = parseLinkHeader(header);
				for (const key of Object.keys(result) as Array<keyof typeof result>) {
					expect(REL_TYPES).toContain(key);
				}
			}),
			{ numRuns: 100 },
		);
	});

	test("null and undefined always produce empty object", () => {
		const nullish = FastCheck.constantFrom(null, undefined, "");
		FastCheck.assert(
			FastCheck.property(nullish, (input) => {
				const result = parseLinkHeader(input);
				expect(Object.keys(result)).toHaveLength(0);
			}),
			{ numRuns: 10 },
		);
	});

	test("random strings never throw", () => {
		FastCheck.assert(
			FastCheck.property(FastCheck.string({ maxLength: 500 }), (input) => {
				expect(() => parseLinkHeader(input)).not.toThrow();
			}),
			{ numRuns: 100 },
		);
	});
});
