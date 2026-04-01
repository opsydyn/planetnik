import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { Effect } from "effect";
import { acquireTempDir } from "../commands/analyzeLandscape.js";

describe("acquireTempDir", () => {
	test("creates a directory that exists during the scope", async () => {
		let capturedDir = "";

		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const dir = yield* acquireTempDir("test");
					capturedDir = dir;
					expect(existsSync(dir)).toBe(true);
				}),
			),
		);

		// After scope closes, finalizer should have removed it
		expect(capturedDir).not.toBe("");
		expect(existsSync(capturedDir)).toBe(false);
	});

	test("cleans up directory even when the scoped effect fails", async () => {
		let capturedDir = "";

		const result = await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const dir = yield* acquireTempDir("test-fail");
					capturedDir = dir;
					expect(existsSync(dir)).toBe(true);
					yield* Effect.fail("simulated failure");
				}),
			).pipe(Effect.either),
		);

		expect(result._tag).toBe("Left");
		expect(existsSync(capturedDir)).toBe(false);
	});

	test("creates unique directories for concurrent scopes", async () => {
		const dirs: string[] = [];

		await Effect.runPromise(
			Effect.all(
				Array.from({ length: 5 }, () =>
					Effect.scoped(
						Effect.gen(function* () {
							const dir = yield* acquireTempDir("test-concurrent");
							dirs.push(dir);
							expect(existsSync(dir)).toBe(true);
						}),
					),
				),
				{ concurrency: 5 },
			),
		);

		// All dirs should be unique
		const unique = new Set(dirs);
		expect(unique.size).toBe(5);

		// All dirs should be cleaned up
		for (const dir of dirs) {
			expect(existsSync(dir)).toBe(false);
		}
	});

	test("directory path includes the provided prefix", async () => {
		await Effect.runPromise(
			Effect.scoped(
				Effect.gen(function* () {
					const dir = yield* acquireTempDir("my-prefix");
					expect(dir).toContain("my-prefix");
				}),
			),
		);
	});
});
