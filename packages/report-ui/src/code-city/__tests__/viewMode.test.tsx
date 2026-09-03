import { describe, expect, test } from "bun:test";
import type { ReactElement, ReactNode } from "react";
import {
	formatCodeCityFallbackInspectLabel,
	type CodeCityFallbackRow,
} from "../CodeCityFallback.js";
import { CodeCityViewControls } from "../CodeCityViewControls.js";
import {
	resolveCodeCityViewMode,
	type CodeCityViewMode,
} from "../viewMode.js";

const stylesheet = await Bun.file(new URL("../CodeCityView.css", import.meta.url)).text();

const textContent = (node: ReactNode): string => {
	if (typeof node === "string" || typeof node === "number") return String(node);
	if (node === null || node === undefined || typeof node === "boolean") return "";
	if (Array.isArray(node)) return node.map(textContent).join("");
	const element = node as ReactElement<{ readonly children?: ReactNode }>;
	return textContent(element.props.children);
};

const blockContents = (source: string, marker: string): string => {
	const markerIndex = source.indexOf(marker);
	if (markerIndex === -1) return "";
	const openingBrace = source.indexOf("{", markerIndex + marker.length);
	if (openingBrace === -1) return "";
	let depth = 1;
	for (let index = openingBrace + 1; index < source.length; index += 1) {
		if (source[index] === "{") depth += 1;
		if (source[index] === "}") depth -= 1;
		if (depth === 0) return source.slice(openingBrace + 1, index);
	}
	return "";
};

const declarationsFor = (source: string, selector: string): string =>
	blockContents(source, selector)
		.replaceAll(/\s+/g, " ")
		.trim();

type ViewButtonProps = {
	readonly type: "button";
	readonly children: ReactNode;
	readonly disabled?: boolean;
	readonly "aria-controls"?: string;
	readonly "aria-pressed"?: boolean;
	readonly "aria-keyshortcuts"?: string;
	readonly title?: string;
	readonly onClick: () => void;
};

describe("resolveCodeCityViewMode", () => {
	test("honours an explicit table request while WebGL remains available", () => {
		expect(
			resolveCodeCityViewMode("map", {
				denseDataMode: false,
				rendererUnavailable: false,
			}),
		).toBe("map");
		expect(
			resolveCodeCityViewMode("table", {
				denseDataMode: false,
				rendererUnavailable: false,
			}),
		).toBe("table");
	});

	test("forces the table when dense data or renderer failure makes the map unavailable", () => {
		expect(
			resolveCodeCityViewMode("map", {
				denseDataMode: true,
				rendererUnavailable: false,
			}),
		).toBe("table");
		expect(
			resolveCodeCityViewMode("map", {
				denseDataMode: false,
				rendererUnavailable: true,
			}),
		).toBe("table");
	});
});

describe("CodeCityViewControls", () => {
	test("exposes a keyboard-native Table view control that changes the requested view", () => {
		const changes: CodeCityViewMode[] = [];
		const control = CodeCityViewControls({
			mode: "map",
			mapAvailable: true,
			onChange: (mode) => changes.push(mode),
		});
		const buttons = control.props.children as ReactElement<ViewButtonProps>[];
		const tableButton = buttons[1];

		expect(control.props.role).toBe("group");
		expect(control.props["aria-label"]).toBe("Code City view");
		expect(tableButton?.type).toBe("button");
		expect(tableButton?.props).toMatchObject({
			type: "button",
			children: "Table view",
			"aria-controls": "code-city-fallback",
			"aria-pressed": false,
		});

		tableButton?.props.onClick();
		expect(changes).toEqual(["table"]);
	});

	test("exposes a reset overview control with a Home shortcut", () => {
		const changes: CodeCityViewMode[] = [];
		let resetCalls = 0;
		const control = CodeCityViewControls({
			mode: "map",
			mapAvailable: true,
			canReset: true,
			onChange: (mode) => changes.push(mode),
			onReset: () => {
				resetCalls += 1;
			},
		});
		const buttons = (control.props.children as Array<ReactElement<ViewButtonProps> | null>).filter(
			(button): button is ReactElement<ViewButtonProps> => button !== null,
		);
		const resetButton = buttons[2];

		expect(resetButton?.props).toMatchObject({
			"aria-controls": "code-city-map",
			"aria-keyshortcuts": "Home",
			title: "Reset the camera to the overview (Home)",
		});
		expect(textContent(resetButton)).toContain("Reset overview");
		expect(textContent(resetButton)).toContain("Home");
		expect(resetButton?.props.disabled).toBe(false);
		resetButton?.props.onClick();
		expect(resetCalls).toBe(1);

		const fallbackControl = CodeCityViewControls({
			mode: "table",
			mapAvailable: false,
			canReset: false,
			onChange: (mode) => changes.push(mode),
			onReset: () => undefined,
		});
		const fallbackButtons = (
			fallbackControl.props.children as Array<ReactElement<ViewButtonProps> | null>
		).filter((button): button is ReactElement<ViewButtonProps> => button !== null);

		expect(fallbackButtons[2]?.props.disabled).toBe(true);
	});
});

describe("Code City fallback parity", () => {
	test("keeps the complete table path and entity-specific inspection available", () => {
		const changes: CodeCityViewMode[] = [];
		const row = {
			kind: "building",
			id: "file:runtime",
			entity: "src/runtime.ts",
			district: "Runtime",
			path: "src/runtime.ts",
			loc: "240",
			health: "87 (critical; change)",
			impact: "73 (coupling)",
			form: "Tower · capped roof",
			landmark: "Super hub",
			href: "/planetnik/files/size#runtime",
		} satisfies CodeCityFallbackRow;
		const control = CodeCityViewControls({
			mode: "table",
			mapAvailable: false,
			onChange: (mode) => changes.push(mode),
		});
		const buttons = control.props.children as ReactElement<ViewButtonProps>[];
		const mapButton = buttons[0];
		const tableButton = buttons[1];

		expect(mapButton?.props.disabled).toBe(true);
		expect(tableButton?.props).toMatchObject({
			children: "Table view",
			"aria-controls": "code-city-fallback",
			"aria-pressed": true,
		});
		expect(formatCodeCityFallbackInspectLabel(row)).toBe("Inspect file src/runtime.ts");
	});

	test("keeps responsive controls explicit, reduced motion static, and print evidence readable", () => {
		const tablet = blockContents(stylesheet, "@media (max-width: 1000px)");
		const mobile = blockContents(stylesheet, "@media (max-width: 600px)");
		const reducedMotion = blockContents(
			stylesheet,
			"@media (prefers-reduced-motion: reduce)",
		);
		const print = blockContents(stylesheet, "@media print");

		expect(declarationsFor(tablet, ".code-city__audience-switch")).toContain("order: 2");
		expect(declarationsFor(tablet, ".code-city__lens-buttons")).toContain("order: 3");
		expect(declarationsFor(mobile, ".code-city__story-rail button")).toContain(
			"min-height: 2.75rem",
		);
		expect(declarationsFor(reducedMotion, ".code-city__story-rail")).toContain(
			"animation: none !important",
		);
		expect(declarationsFor(reducedMotion, ".code-city__story-evidence")).toContain(
			"border-left: 2px solid",
		);
		expect(declarationsFor(print, ".code-city__brief")).toContain("display: grid !important");
		expect(declarationsFor(print, ".code-city__brief")).toContain("color: #000");
		expect(declarationsFor(print, ".code-city__brief-actions button")).toContain(
			"display: none",
		);
	});
});
