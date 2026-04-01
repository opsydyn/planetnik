import { describe, expect, test } from "bun:test";
import { Arbitrary, Schema } from "@effect/schema";
import { FastCheck } from "effect";
import { PlanetnikConfigSchema } from "../schemas/PlanetnikConfigSchema.js";

const decode = Schema.decodeUnknownSync(PlanetnikConfigSchema);
const encode = Schema.encodeSync(PlanetnikConfigSchema);
const configArbitrary = Arbitrary.make(PlanetnikConfigSchema);

const VALID_MODES = ["single_repository", "landscape"] as const;

describe("PlanetnikConfigSchema — properties", () => {
	test("any generated config roundtrips through encode → decode", () => {
		FastCheck.assert(
			FastCheck.property(configArbitrary, (config) => {
				const encoded = encode(config);
				const decoded = decode(encoded);
				expect(decoded.mode).toBe(config.mode);
			}),
			{ numRuns: 50 },
		);
	});

	test("mode is always one of the valid literals", () => {
		FastCheck.assert(
			FastCheck.property(configArbitrary, (config) => {
				expect(VALID_MODES).toContain(config.mode);
			}),
			{ numRuns: 50 },
		);
	});

	test("any valid mode value decodes successfully", () => {
		FastCheck.assert(
			FastCheck.property(FastCheck.constantFrom(...VALID_MODES), (mode) => {
				const result = decode({ mode });
				expect(result.mode).toBe(mode);
			}),
			{ numRuns: 20 },
		);
	});

	test("invalid mode strings always reject", () => {
		const invalidMode = FastCheck.string({
			minLength: 1,
			maxLength: 30,
		}).filter((s) => !VALID_MODES.includes(s as (typeof VALID_MODES)[number]));

		FastCheck.assert(
			FastCheck.property(invalidMode, (mode) => {
				expect(() => decode({ mode })).toThrow();
			}),
			{ numRuns: 30 },
		);
	});

	test("non-string mode values always reject", () => {
		const nonString = FastCheck.oneof(
			FastCheck.integer(),
			FastCheck.boolean(),
			FastCheck.constant(null),
			FastCheck.array(FastCheck.string()),
		);

		FastCheck.assert(
			FastCheck.property(nonString, (mode) => {
				expect(() => decode({ mode })).toThrow();
			}),
			{ numRuns: 30 },
		);
	});
});
