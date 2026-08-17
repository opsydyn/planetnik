import type { CodeCityModel } from "@planetnik/common";
import { useMemo, useRef, useState } from "react";
import {
	CodeCityCanvas,
	type CodeCityCanvasHandle,
	type CodeCityCanvasUnavailableReason,
} from "./CodeCityCanvas.js";
import { CodeCityAudienceSwitch } from "./CodeCityAudienceSwitch.js";
import { CodeCityFallback } from "./CodeCityFallback.js";
import { CodeCityInspector } from "./CodeCityInspector.js";
import { CodeCityStoryRail } from "./CodeCityStoryRail.js";
import { CodeCityViewControls } from "./CodeCityViewControls.js";
import {
	buildCodeCityAudiencePresentation,
	getCodeCityAudiencePresentation,
	type CodeCityAudienceId,
} from "./audience.js";
import type { CodeCityLensId, CodeCityLensVisual } from "./lens.js";
import { resolveCodeCityLens } from "./lens.js";
import { buildCodeCityScene } from "./sceneAdapter.js";
import type { CodeCitySelection } from "./selection.js";
import { resolveCodeCitySelection } from "./selection.js";
import {
	buildCodeCityStory,
	reduceCodeCityStoryState,
	type CodeCityStory,
	type CodeCityStoryEvent,
	type CodeCityStoryState,
	type CodeCityStoryStepId,
} from "./story.js";
import {
	buildCodeCityFallbackRows,
	buildCodeCityInspectorModel,
} from "./viewModel.js";
import {
	resolveCodeCityViewMode,
	type CodeCityViewMode,
} from "./viewMode.js";
import "./CodeCityView.css";

export type CodeCityViewProps = {
	readonly model: CodeCityModel;
	readonly evidenceBasePath: string;
	readonly initialAudience?: CodeCityAudienceId;
	readonly initialStoryId?: CodeCityStoryStepId | null;
};

const LENSES: ReadonlyArray<{ readonly id: CodeCityLensId; readonly label: string }> = [
	{ id: "footprint", label: "Footprint" },
	{ id: "health", label: "Health" },
	{ id: "impact", label: "Impact" },
	{ id: "change_pressure", label: "Change" },
	{ id: "ownership", label: "Ownership" },
	{ id: "complexity", label: "Complexity" },
];

const DENSE_NODE_LIMIT = 1_500;
const DENSE_EDGE_LIMIT = 1_000;

const rendererUnavailableMessage = (
	reason: CodeCityCanvasUnavailableReason,
): string => {
	switch (reason) {
		case "webgl-context-unavailable":
			return "WebGL is unavailable in this browser. The complete Code City table is shown instead.";
		case "renderer-initialisation-failed":
			return "The interactive map could not start. The complete Code City table is shown instead.";
		case "renderer-module-unavailable":
			return "The interactive map could not be loaded. The complete Code City table is shown instead.";
	}
};

const initialStoryState = (
	story: CodeCityStory,
	initialStoryId: CodeCityStoryStepId | null | undefined,
): CodeCityStoryState => {
	if (!initialStoryId) return { tag: "idle" };
	const stepIndex = story.steps.findIndex((step) => step.id === initialStoryId);
	return stepIndex === -1 ? { tag: "idle" } : { tag: "active", stepIndex, focused: false };
};

const storyStepFor = (story: CodeCityStory, state: CodeCityStoryState) =>
	state.tag === "active" ? story.steps[state.stepIndex] ?? null : null;

export type CodeCityStoryFocusAction =
	| { readonly type: "focus"; readonly entityId: string }
	| { readonly type: "return-to-overview"; readonly entityId: null }
	| { readonly type: "none" };

export const reduceCodeCityStoryViewState = (
	state: CodeCityStoryState,
	event: CodeCityStoryEvent,
	stepCount: number,
): CodeCityStoryState => {
	const nextState = reduceCodeCityStoryState(state, event, stepCount);
	const preservesFocusedContext =
		state.tag === "active" &&
		state.focused &&
		nextState.tag === "active" &&
		(event.type === "next" || event.type === "back" || event.type === "skip");

	return preservesFocusedContext ? { ...nextState, focused: true } : nextState;
};

export const resolveCodeCityStoryFocusAction = (
	story: CodeCityStory,
	state: CodeCityStoryState,
): CodeCityStoryFocusAction => {
	const step = storyStepFor(story, state);
	if (!step || state.tag !== "active") return { type: "none" };
	if (state.focused) return { type: "return-to-overview", entityId: null };
	return step.target ? { type: "focus", entityId: step.target.id } : { type: "none" };
};

export const resolveCodeCityStoryCompletionAction = (
	previousState: CodeCityStoryState,
	event: CodeCityStoryEvent,
	nextState: CodeCityStoryState,
): CodeCityStoryFocusAction =>
	previousState.tag === "active" &&
	previousState.focused &&
	nextState.tag === "completed" &&
	(event.type === "next" || event.type === "skip")
		? { type: "return-to-overview", entityId: null }
		: { type: "none" };

export default function CodeCityView({
	model,
	evidenceBasePath,
	initialAudience = "onboarding",
	initialStoryId = null,
}: CodeCityViewProps) {
	const canvasRef = useRef<CodeCityCanvasHandle | null>(null);
	const [activeLens, setActiveLens] = useState<CodeCityLensId>("health");
	const [audience, setAudience] = useState<CodeCityAudienceId>(initialAudience);
	const story = useMemo(
		() => buildCodeCityStory(model, audience, evidenceBasePath),
		[model, audience, evidenceBasePath],
	);
	const [storyState, setStoryState] = useState<CodeCityStoryState>(() =>
		initialStoryState(story, initialStoryId),
	);
	const savedStorySelectionRef = useRef<CodeCitySelection>(null);
	const [selection, setSelection] = useState<CodeCitySelection>(
		() => storyStepFor(story, initialStoryState(story, initialStoryId))?.target ?? null,
	);
	const [requestedView, setRequestedView] = useState<CodeCityViewMode>("map");
	const [rendererUnavailable, setRendererUnavailable] =
		useState<CodeCityCanvasUnavailableReason | null>(null);
	const [focusAnnouncement, setFocusAnnouncement] = useState("");

	const scene = useMemo(() => buildCodeCityScene(model), [model]);
	const selectionResult = useMemo(
		() => resolveCodeCitySelection(model, selection),
		[model, selection],
	);
	const presentation = useMemo(
		() => buildCodeCityAudiencePresentation(model, audience),
		[model, audience],
	);
	const inspector = useMemo(
		() => buildCodeCityInspectorModel(model, selection, evidenceBasePath, activeLens, presentation),
		[model, selection, evidenceBasePath, activeLens, presentation],
	);
	const fallbackRows = useMemo(
		() => buildCodeCityFallbackRows(model, evidenceBasePath),
		[model, evidenceBasePath],
	);
	const lensVisuals = useMemo<Readonly<Record<string, CodeCityLensVisual>>>(() => {
		const entities = [...model.districts, ...model.buildings];
		return Object.fromEntries(
			entities.map((entity) => [entity.id, resolveCodeCityLens(entity, activeLens)]),
		);
	}, [model, activeLens]);

	const denseDataMode =
		scene.nodes.length > DENSE_NODE_LIMIT || scene.edges.length > DENSE_EDGE_LIMIT;
	const mapAvailable = !denseDataMode && rendererUnavailable === null;
	const viewMode = resolveCodeCityViewMode(requestedView, {
		denseDataMode,
		rendererUnavailable: rendererUnavailable !== null,
	});
	const fallbackPrimary = viewMode === "table";
	const fallbackStatus = denseDataMode
		? "This snapshot is too dense for the interactive map. The complete Code City table is shown instead."
		: rendererUnavailable
			? rendererUnavailableMessage(rendererUnavailable)
			: requestedView === "table"
				? "Table view selected. Every district, building, and available evidence link remains accessible below."
				: null;
	const activeLegend = model.legend.channels.find((channel) => channel.id === activeLens);
	const activeLensLabel = activeLegend?.label ?? LENSES.find(({ id }) => id === activeLens)?.label;
	const selectionLabel = inspector?.title ?? null;
	const selectedRowIds = useMemo(() => {
		if (!selection) return [];
		if (selection.kind === "building") {
			return [selection.id, ...selectionResult.districtIds];
		}
		return [
			selection.id,
			...model.buildings
				.filter((building) => building.districtIds.includes(selection.id))
				.map((building) => building.id),
		];
	}, [model.buildings, selection, selectionResult.districtIds]);

	const selectEntity = (id: string) => {
		const node = scene.nodes.find((candidate) => candidate.id === id);
		if (!node) return;
		setSelection({ kind: node.kind, id: node.id });
		setFocusAnnouncement(`Selected ${node.label}. Camera position unchanged.`);
	};

	const focusSelection = () => {
		if (!selection) return;
		canvasRef.current?.focusEntity(selection.id);
	};

	const clearSelection = () => {
		canvasRef.current?.focusEntity(null);
		setSelection(null);
		setFocusAnnouncement("Selection cleared. Map view restored if it was focused.");
	};

	const changeAudience = (nextAudience: CodeCityAudienceId) => {
		setAudience(nextAudience);
		setFocusAnnouncement(
			`${getCodeCityAudiencePresentation(nextAudience).label} audience selected. The city geometry is unchanged.`,
		);
	};

	const restoreStoryContext = (announcement: string) => {
		canvasRef.current?.focusEntity(null);
		setSelection(savedStorySelectionRef.current);
		setFocusAnnouncement(announcement);
	};

	const handleStoryEvent = (event: CodeCityStoryEvent) => {
		if (event.type === "exit") {
			restoreStoryContext("Story exited. Previous selection and overview restored.");
			setStoryState(reduceCodeCityStoryState(storyState, event, story.steps.length));
			return;
		}

		if (event.type === "start" && storyState.tag === "idle") {
			savedStorySelectionRef.current = selection;
		}

		const nextState = reduceCodeCityStoryViewState(storyState, event, story.steps.length);
		const completionAction = resolveCodeCityStoryCompletionAction(
			storyState,
			event,
			nextState,
		);
		setStoryState(nextState);
		if (completionAction.type === "return-to-overview") {
			restoreStoryContext("Story complete. Previous selection and overview restored.");
			return;
		}
		const nextStep = storyStepFor(story, nextState);
		if (nextStep) {
			setSelection(nextStep.target);
			setFocusAnnouncement(
				`${nextStep.title}. ${nextStep.availability === "unavailable" ? nextStep.unavailableReason : "Selection updated; camera position unchanged."}`,
			);
			return;
		}
		if (nextState.tag === "completed") {
			setFocusAnnouncement("Story complete. Replay it or exit to return to the previous selection.");
		}
	};

	const focusStoryStep = () => {
		const action = resolveCodeCityStoryFocusAction(story, storyState);
		if (action.type === "return-to-overview" && storyState.tag === "active") {
			restoreStoryContext("Overview restored. Previous selection returned.");
			setStoryState({ ...storyState, focused: false });
			return;
		}
		if (action.type !== "focus") return;
		canvasRef.current?.focusEntity(action.entityId);
		setStoryState(reduceCodeCityStoryState(storyState, { type: "focus" }, story.steps.length));
		setFocusAnnouncement("Story step focused. Use Return to overview to undo this focus.");
	};

	return (
		<section className="code-city" aria-label="Code City">
			<header className="code-city__controls">
				<div>
					<p className="code-city__eyebrow">Active lens</p>
					<p className="code-city__active-lens" aria-live="polite">
						{activeLensLabel}
					</p>
				</div>
				<CodeCityViewControls
					mode={viewMode}
					mapAvailable={mapAvailable}
					onChange={setRequestedView}
				/>
				<CodeCityAudienceSwitch audience={audience} onChange={changeAudience} />
				<div className="code-city__lens-buttons" role="toolbar" aria-label="Code City lenses">
					{LENSES.map((lens) => (
						<button
							key={lens.id}
							type="button"
							aria-pressed={activeLens === lens.id}
							onClick={() => setActiveLens(lens.id)}
						>
							{lens.label}
						</button>
					))}
				</div>
			</header>

			<section className="code-city__audience" aria-labelledby="code-city-audience-title">
				<div>
					<p className="code-city__eyebrow">What you’re seeing</p>
					<h2 id="code-city-audience-title">{presentation.openingQuestion}</h2>
					<p>{presentation.orientation}</p>
				</div>
				<p>
					<strong>First action:</strong> {presentation.firstAction}
				</p>
				<p>{presentation.coverageNote}</p>
			</section>

			<CodeCityStoryRail
				story={story}
				state={storyState}
				onEvent={handleStoryEvent}
				onFocusStep={focusStoryStep}
			/>

			<div className="code-city__legend" aria-label="Lens legend">
				<ul>
					{model.legend.channels.map((channel) => (
						<li key={channel.id} data-active={channel.id === activeLens ? "true" : "false"}>
							<strong>{channel.label}</strong>
							<span>{channel.unit}</span>
							<small>{channel.source}</small>
						</li>
					))}
				</ul>
			</div>

			<section className="code-city__structure-legend" aria-labelledby="code-city-structure-legend-title">
				<h2 id="code-city-structure-legend-title">Structure legend</h2>
				<ul>
					<li><strong>Material</strong> names the canonical source-language family.</li>
					<li><strong>Silhouette</strong> describes the deterministic archetype and roof.</li>
					<li><strong>Scale</strong> reflects lines of code and remains stable across lenses.</li>
					<li><strong>Lens treatment</strong> adds surface detail without moving or reshaping the city.</li>
				</ul>
			</section>

			{fallbackPrimary ? null : (
				<div className="code-city__workspace">
					<div id="code-city-map" className="code-city__map">
						<CodeCityCanvas
							ref={canvasRef}
							scene={scene}
							lensVisuals={lensVisuals}
							selectionResult={selectionResult}
							presentation={presentation}
							denseDataMode={denseDataMode}
							onSelect={selectEntity}
							onFocusComplete={() =>
								setFocusAnnouncement(
									selection ? `Focused on ${inspector?.title ?? selection.id}.` : "Map view restored.",
								)
							}
							onRendererUnavailable={setRendererUnavailable}
						/>
						<p
							className="code-city__map-status"
							role="status"
							tabIndex={0}
						>
							{selectionResult.selection
								? `${selectionResult.incidentEdgeIds.length} connected dependency ${selectionResult.incidentEdgeIds.length === 1 ? "route" : "routes"}.`
								: "Select a district or building to inspect it. Selection does not move the camera."}
						</p>
					</div>
					<CodeCityInspector
						inspector={inspector}
						canFocus={selection !== null}
						onFocus={focusSelection}
						onClear={clearSelection}
					/>
				</div>
			)}

			{fallbackPrimary && inspector ? (
				<CodeCityInspector
					inspector={inspector}
					canFocus={false}
					onFocus={focusSelection}
					onClear={clearSelection}
				/>
			) : null}

			<CodeCityFallback
				rows={fallbackRows}
				status={fallbackStatus}
				primary={fallbackPrimary}
				selectionLabel={selectionLabel}
				selectedRowIds={selectedRowIds}
				onSelect={selectEntity}
			/>
			<p className="code-city__sr-status" aria-live="polite">
				{focusAnnouncement}
			</p>
		</section>
	);
}
