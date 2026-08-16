import type { CodeCityModel, CodeCityReportMode } from "@planetnik/common";

export type CodeCityRouteState =
	| { readonly tag: "ready"; readonly model: CodeCityModel }
	| { readonly tag: "partial"; readonly model: CodeCityModel }
	| { readonly tag: "unsupported-landscape"; readonly title: string }
	| { readonly tag: "invalid"; readonly message: string }
	| { readonly tag: "empty"; readonly model: CodeCityModel };

export type CodeCityRouteResolution =
	| { readonly tag: "model"; readonly model: CodeCityModel }
	| { readonly tag: "invalid"; readonly message: string };

export type CodeCityRouteStateInput = {
	readonly title: string;
	readonly reportMode: CodeCityReportMode | undefined;
	readonly resolution: CodeCityRouteResolution;
};

export function resolveCodeCityRouteState(
	input: CodeCityRouteStateInput,
): CodeCityRouteState {
	if (input.reportMode === "landscape") {
		return { tag: "unsupported-landscape", title: input.title };
	}

	if (input.resolution.tag === "invalid") {
		return input.resolution;
	}

	const { model } = input.resolution;
	if (model.buildings.length === 0) return { tag: "empty", model };

	return model.coverage.missingOptionalShards.length > 0
		? { tag: "partial", model }
		: { tag: "ready", model };
}
