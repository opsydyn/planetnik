import type { CodeCityViewMode } from "./viewMode.js";

export type CodeCityViewControlsProps = {
	readonly mode: CodeCityViewMode;
	readonly mapAvailable: boolean;
	readonly onChange: (mode: CodeCityViewMode) => void;
};

export function CodeCityViewControls({
	mode,
	mapAvailable,
	onChange,
}: CodeCityViewControlsProps) {
	return (
		<div className="code-city__view-buttons" role="group" aria-label="Code City view">
			<button
				type="button"
				aria-controls="code-city-map"
				aria-pressed={mode === "map"}
				disabled={!mapAvailable}
				onClick={() => onChange("map")}
			>
				Map view
			</button>
			<button
				type="button"
				aria-controls="code-city-fallback"
				aria-pressed={mode === "table"}
				onClick={() => onChange("table")}
			>
				Table view
			</button>
		</div>
	);
}

export default CodeCityViewControls;
