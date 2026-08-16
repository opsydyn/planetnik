import { describe, expect, test } from "bun:test";
import type { ReactElement, ReactNode } from "react";
import { CodeCityViewControls } from "../CodeCityViewControls.js";
import {
	resolveCodeCityViewMode,
	type CodeCityViewMode,
} from "../viewMode.js";

type ViewButtonProps = {
	readonly type: "button";
	readonly children: ReactNode;
	readonly disabled?: boolean;
	readonly "aria-controls": string;
	readonly "aria-pressed": boolean;
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
});
