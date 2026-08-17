import {
	forwardRef,
	type Ref,
	useEffect,
	useImperativeHandle,
	useRef,
	useState,
} from "react";
import type { CodeCityLensVisual } from "./lens.js";
import type { CodeCityScene } from "./sceneTypes.js";
import type { CodeCitySelectionResult } from "./selection.js";
import type {
	CodeCityRendererController,
	CodeCityRendererPresentation,
	CodeCityRendererStatus,
	CodeCityRendererUnavailableReason,
} from "./threeRenderer.js";

export type CodeCityCanvasUnavailableReason =
	| CodeCityRendererUnavailableReason
	| "renderer-module-unavailable";

export type CodeCityCanvasHandle = {
	readonly focusEntity: (id: string | null) => boolean;
};

export const tryFocusCodeCityRenderer = (
	controller: Pick<CodeCityRendererController, "focusEntity"> | null,
	id: string | null,
): boolean => {
	if (!controller) return false;
	controller.focusEntity(id);
	return true;
};

export type CodeCityCanvasProps = {
	readonly scene: CodeCityScene;
	readonly lensVisuals: Readonly<Record<string, CodeCityLensVisual>>;
	readonly selectionResult: CodeCitySelectionResult;
	readonly presentation: CodeCityRendererPresentation;
	readonly denseDataMode: boolean;
	readonly onSelect: (id: string) => void;
	readonly onFocusComplete: () => void;
	readonly onRendererUnavailable: (
		reason: CodeCityCanvasUnavailableReason,
	) => void;
	readonly label?: string;
};

function CodeCityCanvasInner(
	{
		scene,
		lensVisuals,
		selectionResult,
		presentation,
		denseDataMode,
		onSelect,
		onFocusComplete,
		onRendererUnavailable,
		label = "Interactive Code City map",
	}: CodeCityCanvasProps,
	ref: Ref<CodeCityCanvasHandle>,
) {
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const controllerRef = useRef<CodeCityRendererController | null>(null);
	const lensVisualsRef = useRef(lensVisuals);
	const selectionResultRef = useRef(selectionResult);
	const presentationRef = useRef(presentation);
	const callbacksRef = useRef({
		onSelect,
		onFocusComplete,
		onRendererUnavailable,
	});
	const [status, setStatus] = useState<CodeCityRendererStatus>("pending");

	lensVisualsRef.current = lensVisuals;
	selectionResultRef.current = selectionResult;
	presentationRef.current = presentation;
	callbacksRef.current = {
		onSelect,
		onFocusComplete,
		onRendererUnavailable,
	};

	useImperativeHandle(
		ref,
		() => ({
			focusEntity(id) {
				return tryFocusCodeCityRenderer(controllerRef.current, id);
			},
		}),
		[],
	);

	useEffect(() => {
		let cancelled = false;
		let controller: CodeCityRendererController | null = null;
		setStatus("pending");

		void import("./threeRenderer.js")
			.then(({ createCodeCityRenderer }) => {
				if (cancelled || !canvasRef.current) return;
				controller = createCodeCityRenderer({
					canvas: canvasRef.current,
					scene,
					lensVisuals: lensVisualsRef.current,
					selectionResult: selectionResultRef.current,
					presentation: presentationRef.current,
					denseDataMode,
					onSelect: (id) => callbacksRef.current.onSelect(id),
					onFocusComplete: () => callbacksRef.current.onFocusComplete(),
					onRendererUnavailable: (reason) => {
						setStatus("unavailable");
						callbacksRef.current.onRendererUnavailable(reason);
					},
				});
				controllerRef.current = controller;
				if (controller) setStatus("ready");
			})
			.catch(() => {
				if (cancelled) return;
				setStatus("unavailable");
				callbacksRef.current.onRendererUnavailable(
					"renderer-module-unavailable",
				);
			});

		return () => {
			cancelled = true;
			if (controllerRef.current === controller) controllerRef.current = null;
			controller?.dispose();
		};
	}, [scene, denseDataMode]);

	useEffect(() => {
		controllerRef.current?.setLensVisuals(lensVisuals);
	}, [lensVisuals]);

	useEffect(() => {
		controllerRef.current?.setSelectionResult(selectionResult);
	}, [selectionResult]);

	useEffect(() => {
		controllerRef.current?.setPresentation(presentation);
	}, [presentation]);

	return (
		<canvas
			ref={canvasRef}
			aria-label={label}
			aria-busy={status === "pending"}
			data-renderer-status={status}
			style={{ display: "block", width: "100%", height: "100%" }}
		/>
	);
}

export const CodeCityCanvas = forwardRef(CodeCityCanvasInner);

CodeCityCanvas.displayName = "CodeCityCanvas";

export default CodeCityCanvas;
