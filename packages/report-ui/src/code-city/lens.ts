import type {
	CodeCityBuilding,
	CodeCityDistrict,
	CodeCitySignals,
	CodeCityUnit,
} from "@planetnik/common";
import {
	resolveCodeCitySurfaceTreatment,
	type CodeCitySurfaceTreatment,
} from "./materials.js";

export type CodeCityLensId =
	| "footprint"
	| "complexity"
	| "health"
	| "change_pressure"
	| "ownership"
	| "impact";

export type CodeCityLensVisual = {
	readonly lens: CodeCityLensId;
	readonly available: boolean;
	readonly fill: string;
	readonly accent: string;
	readonly label: string;
	readonly unavailableReason: string | null;
	readonly surfaceTreatment: CodeCitySurfaceTreatment;
	readonly nonColorCue: string;
};

export type CodeCityLensEntity =
	| CodeCityDistrict
	| CodeCityBuilding
	| CodeCityUnit
	| { readonly metrics: CodeCitySignals };

type Palette = {
	readonly fill: string;
	readonly accent: string;
};

const NEUTRAL_PALETTE: Palette = { fill: "#64748b", accent: "#64748b" };

const lensName = (lens: CodeCityLensId): string => {
	switch (lens) {
		case "footprint":
			return "Footprint";
		case "complexity":
			return "Complexity";
		case "health":
			return "Health";
		case "change_pressure":
			return "Change";
		case "ownership":
			return "Ownership";
		case "impact":
			return "Impact";
	}
};

const nonColorCue = (lens: CodeCityLensId, available: boolean): string => {
	const name = lensName(lens);
	if (!available) return `${name} has no overlay because the signal is unavailable.`;

	switch (lens) {
		case "footprint":
			return "Footprint uses neutral surfaces; building scale remains the LOC cue.";
		case "complexity":
			return "Complexity uses wear marks without changing the building form.";
		case "health":
			return "Health uses impact markers to show health severity without changing the building form.";
		case "change_pressure":
			return "Change uses scaffold details without changing the building form.";
		case "ownership":
			return "Ownership uses banners to show contributor concentration without changing the parcel layout.";
		case "impact":
			return "Impact uses machinery details without changing the building form.";
	}
};

const withSurfaceTreatment = (
	visual: Omit<CodeCityLensVisual, "surfaceTreatment" | "nonColorCue">,
): CodeCityLensVisual => {
	const surfaceTreatment = resolveCodeCitySurfaceTreatment(
		visual as CodeCityLensVisual,
	);
	return {
		...visual,
		surfaceTreatment,
		nonColorCue: nonColorCue(visual.lens, visual.available),
	};
};

const unavailable = (
	lens: CodeCityLensId,
	label: string,
): CodeCityLensVisual =>
	withSurfaceTreatment({
		lens,
		available: false,
		...NEUTRAL_PALETTE,
		label,
		unavailableReason: label,
	});

const available = (
	lens: CodeCityLensId,
	palette: Palette,
	label: string,
): CodeCityLensVisual =>
	withSurfaceTreatment({
		lens,
		available: true,
		...palette,
		label,
		unavailableReason: null,
	});

const isMeasured = (value: number | null): value is number =>
	value !== null && Number.isFinite(value);

const riskPalette = (value: number): Palette => {
	if (value >= 20) return { fill: "#b91c1c", accent: "#fecaca" };
	if (value >= 10) return { fill: "#a16207", accent: "#fde68a" };
	return { fill: "#166534", accent: "#bbf7d0" };
};

const healthPalette = (severity: string | null): Palette => {
	switch (severity?.trim().toLowerCase()) {
		case "critical":
			return { fill: "#991b1b", accent: "#fecaca" };
		case "high":
			return { fill: "#c2410c", accent: "#fed7aa" };
		case "medium":
			return { fill: "#a16207", accent: "#fde68a" };
		case "low":
			return { fill: "#166534", accent: "#bbf7d0" };
		default:
			return { fill: "#1d4ed8", accent: "#bfdbfe" };
	}
};

const changePalette = (commits: number | null, temporalLinks: number | null): Palette =>
	riskPalette(Math.max(commits ?? 0, temporalLinks ?? 0));

const ownershipPalette = (contributorCount: number): Palette => {
	if (contributorCount >= 4) return { fill: "#7e22ce", accent: "#e9d5ff" };
	if (contributorCount >= 2) return { fill: "#4338ca", accent: "#c7d2fe" };
	return { fill: "#0369a1", accent: "#bae6fd" };
};

const formatCount = (count: number, singular: string): string =>
	`${count} ${singular}${count === 1 ? "" : "s"}`;

export function resolveCodeCityLens(
	entity: CodeCityLensEntity,
	lens: CodeCityLensId = "health",
): CodeCityLensVisual {
	const { metrics } = entity;

	switch (lens) {
		case "footprint":
			return available(
				lens,
				{ fill: "#475569", accent: "#38bdf8" },
				`Footprint: ${metrics.footprint.loc} LOC`,
			);
		case "complexity": {
			const maxMcCabe = metrics.complexity.maxMcCabe;
			return isMeasured(maxMcCabe)
				? available(lens, riskPalette(maxMcCabe), `Complexity: McCabe ${maxMcCabe}`)
				: unavailable(lens, "Complexity unavailable");
		}
		case "health": {
			const score = metrics.health.score;
			if (!isMeasured(score)) return unavailable(lens, "Health unavailable");
			const severity = metrics.health.severity?.trim().toLowerCase() || "unclassified";
			return available(lens, healthPalette(metrics.health.severity), `Health: ${score} (${severity})`);
		}
		case "change_pressure": {
			const { commits, temporalLinks } = metrics.change;
			if (!isMeasured(commits) && !isMeasured(temporalLinks)) {
				return unavailable(lens, "Change pressure unavailable");
			}
			const values = [
				isMeasured(commits) ? formatCount(commits, "commit") : null,
				isMeasured(temporalLinks) ? formatCount(temporalLinks, "temporal link") : null,
			].filter((value): value is string => value !== null);
			return available(lens, changePalette(commits, temporalLinks), `Change: ${values.join(", ")}`);
		}
		case "ownership": {
			const contributorCount = metrics.ownership.contributorCount;
			return contributorCount > 0
				? available(
					lens,
					ownershipPalette(contributorCount),
					`Ownership: ${formatCount(contributorCount, "contributor")}`,
				)
				: unavailable(lens, "Ownership unavailable");
		}
		case "impact": {
			const score = metrics.impact.score;
			if (!isMeasured(score)) return unavailable(lens, "Impact unavailable");
			const dimension = metrics.impact.dimension?.trim();
			return available(
				lens,
				riskPalette(score),
				`Impact: ${score}${dimension ? ` (${dimension})` : ""}`,
			);
		}
	}
}
