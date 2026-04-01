import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Schema } from "@effect/schema";

/**
 * Schema for planetnik.config.json — project-level configuration.
 *
 * Lives in the project root and controls how Planetnik behaves
 * for this workspace (e.g. whether the site shows landscape or
 * single-repository views).
 */
export const PlanetnikConfigSchema = Schema.Struct({
	mode: Schema.optionalWith(Schema.Literal("single_repository", "landscape"), {
		default: () => "single_repository" as const,
	}),
});

export type PlanetnikConfig = typeof PlanetnikConfigSchema.Type;

const CONFIG_FILENAME = "planetnik.config.json";

/** Decode and validate planetnik.config.json from the given directory (defaults to cwd). */
export function loadPlanetnikConfig(root?: string): PlanetnikConfig {
	const dir = root ?? process.cwd();
	const configPath = join(dir, CONFIG_FILENAME);

	if (!existsSync(configPath)) {
		return Schema.decodeUnknownSync(PlanetnikConfigSchema)({});
	}

	const raw = JSON.parse(readFileSync(configPath, "utf-8"));
	return Schema.decodeUnknownSync(PlanetnikConfigSchema)(raw);
}
