import dagre from "@dagrejs/dagre";
import {
	RegistryProvider,
	useAtom,
	useAtomValue,
} from "@effect-atom/atom-react";
import {
	Background,
	type Edge,
	type Node,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { chartHelp } from "../lib/chartHelp";
import {
	getContributorDisplayName,
	getContributorHref as getDefaultContributorHref,
} from "../lib/contributors";
import { buildContributorForceGraph } from "../lib/forceGraph";
import { getLandscapeRepositoryContributorHref } from "../lib/landscapeRoutes";
import { route } from "../lib/route";
import {
	currentEdgesAtom,
	type PeopleDep,
	selectedPeriodAtom,
	sortedEdgesAtom,
	topologyPeriodsAtom,
	topologyStatsAtom,
} from "../state/topologyGraphState";
import ForceGraph from "./graphs/ForceGraph";

interface TopologyGraphProps {
	periods: Record<string, PeopleDep[]>;
	impactPeriods: Record<string, ContributorImpactContributor[]>;
	getContributorHref?: (email: string) => string;
	contributorRepoKey?: string | null;
	componentsHref?: string | null;
}

type ContributorImpactDimensionKey =
	| "complexity_reduction"
	| "boundary_shaping"
	| "knowledge_spread"
	| "coordination_relief"
	| "change_enablement";

interface ContributorImpactContributor {
	email: string;
	display_name: string;
	glue_score: number;
	snacking_score: number;
	structural_impact_score: number;
	visible_activity_score: number;
	collaborator_count: number;
	shared_files_count: number;
	commits_count: number;
	files_touched: number;
	components_touched: number;
	dominant_dimension: ContributorImpactDimensionKey;
	dimensions: Record<ContributorImpactDimensionKey, number>;
	top_components: Array<{ name: string; files: number; commits: number }>;
	top_routes: string[];
	reasons: string[];
	is_glue: boolean;
	is_snacking: boolean;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 72;
const DAGRE_NODE_THRESHOLD = 120;
const DAGRE_EDGE_THRESHOLD = 600;
const DAGRE_MAX_RENDERED_NODES = 84;
const DAGRE_MAX_RENDERED_EDGES = 240;
const DAGRE_SELECTED_CONTRIBUTOR_EDGE_BONUS = 12;

type PlanetnikWindow = Window & {
	__planetnikRouteVersion?: number;
};

type ReactFlowHandle = {
	fitView: (options?: { padding?: number; duration?: number }) => void;
};

function getRouteVersion(): number {
	if (typeof window === "undefined") return 0;
	return (window as PlanetnikWindow).__planetnikRouteVersion ?? 0;
}

const dimensionLabelMap: Record<ContributorImpactDimensionKey, string> = {
	complexity_reduction: "Complexity reduction",
	boundary_shaping: "Boundary shaping",
	knowledge_spread: "Knowledge spread",
	coordination_relief: "Coordination relief",
	change_enablement: "Change enablement",
};

function layoutWithDagre(nodes: Node[], edges: Edge[]) {
	const g = new dagre.graphlib.Graph();
	g.setDefaultEdgeLabel(() => ({}));
	g.setGraph({ rankdir: "TB", nodesep: 80, ranksep: 120 });

	for (const node of nodes) {
		g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
	}
	for (const edge of edges) {
		g.setEdge(edge.source, edge.target);
	}

	dagre.layout(g);

	return {
		nodes: nodes.map((node) => {
			const pos = g.node(node.id);
			return {
				...node,
				position: { x: pos.x - NODE_WIDTH / 2, y: pos.y - NODE_HEIGHT / 2 },
			};
		}),
		edges,
	};
}

function getEdgeKey(edge: Pick<PeopleDep, "from" | "to">): string {
	return [edge.from, edge.to]
		.sort((left, right) => left.localeCompare(right))
		.join("::");
}

function countGraphNodes(edges: PeopleDep[]): number {
	const nodes = new Set<string>();
	for (const edge of edges) {
		nodes.add(edge.from);
		nodes.add(edge.to);
	}
	return nodes.size;
}

function sortEdgesByStrength(edges: PeopleDep[]): PeopleDep[] {
	return [...edges].sort((left, right) => {
		if (left.count !== right.count) return right.count - left.count;
		return getEdgeKey(left).localeCompare(getEdgeKey(right));
	});
}

function buildStructuredTopologyEdges(
	rawEdges: PeopleDep[],
	selectedContributorEmail: string | null,
): {
	edges: PeopleDep[];
	isCapped: boolean;
	displayedNodeCount: number;
	totalNodeCount: number;
	hiddenConnectionCount: number;
} {
	const totalNodeCount = countGraphNodes(rawEdges);

	if (
		totalNodeCount <= DAGRE_NODE_THRESHOLD &&
		rawEdges.length <= DAGRE_EDGE_THRESHOLD
	) {
		return {
			edges: rawEdges,
			isCapped: false,
			displayedNodeCount: totalNodeCount,
			totalNodeCount,
			hiddenConnectionCount: 0,
		};
	}

	const nodeWeights = new Map<string, number>();
	for (const edge of rawEdges) {
		nodeWeights.set(edge.from, (nodeWeights.get(edge.from) ?? 0) + edge.count);
		nodeWeights.set(edge.to, (nodeWeights.get(edge.to) ?? 0) + edge.count);
	}

	const preferredNodeIds = new Set(
		[...nodeWeights.entries()]
			.sort((left, right) => {
				if (left[1] !== right[1]) return right[1] - left[1];
				return left[0].localeCompare(right[0]);
			})
			.slice(0, DAGRE_MAX_RENDERED_NODES)
			.map(([id]) => id),
	);

	if (selectedContributorEmail) {
		preferredNodeIds.add(selectedContributorEmail);

		const selectedContributorEdges = sortEdgesByStrength(
			rawEdges.filter(
				(edge) =>
					edge.from === selectedContributorEmail ||
					edge.to === selectedContributorEmail,
			),
		).slice(0, DAGRE_SELECTED_CONTRIBUTOR_EDGE_BONUS);

		for (const edge of selectedContributorEdges) {
			preferredNodeIds.add(edge.from);
			preferredNodeIds.add(edge.to);
		}
	}

	let structuredEdges = sortEdgesByStrength(
		rawEdges.filter(
			(edge) =>
				preferredNodeIds.has(edge.from) && preferredNodeIds.has(edge.to),
		),
	).slice(0, DAGRE_MAX_RENDERED_EDGES);

	if (structuredEdges.length === 0) {
		structuredEdges = sortEdgesByStrength(rawEdges).slice(
			0,
			Math.min(DAGRE_MAX_RENDERED_EDGES, rawEdges.length),
		);
	}

	const displayedNodeCount = countGraphNodes(structuredEdges);

	return {
		edges: structuredEdges,
		isCapped:
			structuredEdges.length < rawEdges.length ||
			displayedNodeCount < totalNodeCount,
		displayedNodeCount,
		totalNodeCount,
		hiddenConnectionCount: Math.max(
			rawEdges.length - structuredEdges.length,
			0,
		),
	};
}

function truncateEmail(email: string): string {
	const at = email.indexOf("@");
	if (at < 0) return email.length > 20 ? `${email.slice(0, 17)}...` : email;
	const local = email.slice(0, at);
	return local.length > 18 ? `${local.slice(0, 15)}...` : local;
}

function getNodeLabel(
	email: string,
	contributorImpact?: ContributorImpactContributor,
) {
	if (contributorImpact?.display_name) {
		const displayName = contributorImpact.display_name.trim();
		if (displayName) {
			const firstName = displayName.split(/\s+/)[0] ?? displayName;
			return firstName.length > 16 ? `${firstName.slice(0, 13)}...` : firstName;
		}
	}

	return truncateEmail(email);
}

function getContributorPills(contributorImpact?: ContributorImpactContributor) {
	if (!contributorImpact) return [];

	const pills: Array<{ label: string; background: string; color: string }> = [];
	if (contributorImpact.is_glue) {
		pills.push({
			label: "Glue",
			background: "var(--chart-green)",
			color: "#052e16",
		});
	}
	if (contributorImpact.is_snacking) {
		pills.push({
			label: "Snack",
			background: "var(--chart-orange)",
			color: "#431407",
		});
	}
	return pills;
}

function buildGraph(
	rawEdges: PeopleDep[],
	contributorImpactMap: Map<string, ContributorImpactContributor>,
	selectedContributorEmail: string | null,
) {
	const connectionCounts = new Map<string, number>();
	for (const e of rawEdges) {
		connectionCounts.set(e.from, (connectionCounts.get(e.from) ?? 0) + e.count);
		connectionCounts.set(e.to, (connectionCounts.get(e.to) ?? 0) + e.count);
	}

	const maxConn = Math.max(...connectionCounts.values(), 1);

	const nodeIds = new Set<string>();
	for (const e of rawEdges) {
		nodeIds.add(e.from);
		nodeIds.add(e.to);
	}

	const nodes: Node[] = Array.from(nodeIds).map((id) => {
		const connections = connectionCounts.get(id) ?? 0;
		const intensity = Math.min(connections / maxConn, 1);
		const contributorImpact = contributorImpactMap.get(id);
		const pills = getContributorPills(contributorImpact);
		const isSelected = selectedContributorEmail === id;
		const r = Math.round(99 + (239 - 99) * intensity);
		const g = Math.round(102 + (68 - 102) * intensity);
		const b = Math.round(241 + (68 - 241) * intensity);

		return {
			id,
			data: {
				label: (
					<div
						style={{
							display: "grid",
							gap: "0.3rem",
							justifyItems: "center",
							width: "100%",
						}}
						title={id}
					>
						<span
							style={{
								display: "block",
								maxWidth: "100%",
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
								fontSize: "12px",
								fontWeight: 600,
								lineHeight: 1.2,
							}}
						>
							{getNodeLabel(id, contributorImpact)}
						</span>
						{pills.length > 0 ? (
							<span
								style={{
									display: "flex",
									gap: "0.3rem",
									justifyContent: "center",
									flexWrap: "wrap",
								}}
							>
								{pills.map((pill) => (
									<span
										key={pill.label}
										style={{
											background: pill.background,
											color: pill.color,
											borderRadius: "999px",
											fontSize: "10px",
											fontWeight: 700,
											lineHeight: 1,
											padding: "0.18rem 0.38rem",
											textTransform: "uppercase",
											letterSpacing: "0.04em",
										}}
									>
										{pill.label}
									</span>
								))}
							</span>
						) : null}
					</div>
				),
			},
			position: { x: 0, y: 0 },
			style: {
				background: `rgb(${r}, ${g}, ${b})`,
				color: "#fff",
				border: contributorImpact?.is_glue
					? "2px solid var(--chart-green)"
					: contributorImpact?.is_snacking
						? "2px solid var(--chart-orange)"
						: "1px solid transparent",
				borderRadius: "8px",
				padding: "8px 10px",
				width: NODE_WIDTH,
				minHeight: NODE_HEIGHT,
				textAlign: "center" as const,
				cursor: "pointer",
				boxShadow: isSelected
					? "0 0 0 4px var(--color-accent-soft), 0 10px 24px rgba(15, 23, 42, 0.22)"
					: contributorImpact?.is_glue
						? "0 0 0 3px color-mix(in srgb, var(--chart-green) 26%, transparent)"
						: contributorImpact?.is_snacking
							? "0 0 0 3px color-mix(in srgb, var(--chart-orange) 24%, transparent)"
							: "0 6px 18px rgba(15, 23, 42, 0.12)",
			},
		};
	});

	const maxCount = Math.max(...rawEdges.map((e) => e.count), 1);
	const edgeList: Edge[] = rawEdges.map((e, i) => {
		const thickness = Math.max(1, Math.min(6, (e.count / maxCount) * 6));
		const isSelectedEdge =
			selectedContributorEmail === e.from || selectedContributorEmail === e.to;
		return {
			id: `e-${i}`,
			source: e.from,
			target: e.to,
			label: `${e.count}`,
			style: {
				strokeWidth: thickness,
				stroke: isSelectedEdge ? "var(--color-accent)" : "var(--color-border)",
				opacity: isSelectedEdge ? 0.9 : 0.72,
			},
			labelStyle: {
				fontSize: 10,
				fill: isSelectedEdge
					? "var(--color-accent-strong)"
					: "var(--color-text-muted)",
			},
			labelBgStyle: {
				fill: isSelectedEdge ? "var(--color-accent-soft)" : "var(--color-card)",
				fillOpacity: 0.92,
			},
		};
	});

	return layoutWithDagre(nodes, edgeList);
}

const pulseKeyframes = `
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.4; }
  50% { opacity: 1; }
}
`;

function SkeletonBlock({
	width,
	height,
	style,
}: {
	width: string | number;
	height: string | number;
	style?: React.CSSProperties;
}) {
	return (
		<div
			style={{
				width,
				height,
				background: "var(--color-surface-muted)",
				borderRadius: "6px",
				animation: "skeleton-pulse 1.8s ease-in-out infinite",
				...style,
			}}
		/>
	);
}

function GraphSkeleton() {
	// Fake node positions mimicking a dagre TB layout
	const skeletonNodes = [
		{ id: "n0", x: 200, y: 40 },
		{ id: "n1", x: 80, y: 180 },
		{ id: "n2", x: 320, y: 180 },
		{ id: "n3", x: 40, y: 320 },
		{ id: "n4", x: 160, y: 320 },
		{ id: "n5", x: 360, y: 320 },
	];

	const skeletonEdges = [
		{ from: 0, to: 1 },
		{ from: 0, to: 2 },
		{ from: 1, to: 3 },
		{ from: 1, to: 4 },
		{ from: 2, to: 5 },
	];

	return (
		<div
			style={{
				width: "100%",
				height: "600px",
				background: "var(--color-card)",
				borderRadius: "8px",
				border: "1px solid var(--color-border)",
				position: "relative",
				overflow: "hidden",
			}}
		>
			<svg
				width="100%"
				height="100%"
				style={{ position: "absolute", inset: 0 }}
				role="img"
				aria-label="Topology graph loading"
			>
				{skeletonEdges.map(({ from, to }, i) => {
					const f = skeletonNodes[from];
					const t = skeletonNodes[to];
					return (
						<line
							key={`${f.id}-${t.id}`}
							x1={f.x + 90}
							y1={f.y + 25}
							x2={t.x + 90}
							y2={t.y + 25}
							stroke="var(--color-border)"
							strokeWidth={2}
							style={{
								animation: "skeleton-pulse 1.8s ease-in-out infinite",
								animationDelay: `${i * 0.15}s`,
							}}
						/>
					);
				})}
			</svg>
			{skeletonNodes.map((pos, i) => (
				<div
					key={pos.id}
					style={{
						position: "absolute",
						left: pos.x,
						top: pos.y,
						width: NODE_WIDTH,
						height: NODE_HEIGHT,
						background: "var(--color-surface-muted)",
						borderRadius: "8px",
						animation: "skeleton-pulse 1.8s ease-in-out infinite",
						animationDelay: `${i * 0.12}s`,
					}}
				/>
			))}
		</div>
	);
}

function TableSkeleton() {
	const rows = 5;
	return (
		<table style={tableStyle}>
			<thead>
				<tr>
					<th style={thStyle}>Contributor 1</th>
					<th style={thStyle}>Contributor 2</th>
					<th style={{ ...thStyle, textAlign: "right" }}>Shared Files</th>
				</tr>
			</thead>
			<tbody>
				{Array.from({ length: rows }).map((_, i) => (
					<tr key={`skeleton-row-${i}`}>
						<td style={tdBase}>
							<SkeletonBlock
								width={`${60 + (i % 3) * 20}%`}
								height={14}
								style={{ animationDelay: `${i * 0.1}s` }}
							/>
						</td>
						<td style={tdBase}>
							<SkeletonBlock
								width={`${50 + (i % 3) * 15}%`}
								height={14}
								style={{ animationDelay: `${i * 0.1 + 0.05}s` }}
							/>
						</td>
						<td style={{ ...tdBase, textAlign: "right" }}>
							<SkeletonBlock
								width={32}
								height={14}
								style={{
									marginLeft: "auto",
									animationDelay: `${i * 0.1 + 0.1}s`,
								}}
							/>
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

function getDefaultSelectedContributor(
	edges: PeopleDep[],
	contributors: ContributorImpactContributor[],
	graphContributorEmails: Set<string>,
): string | null {
	const topContributor = contributors.find((contributor) =>
		graphContributorEmails.has(contributor.email),
	)?.email;
	if (topContributor) return topContributor;
	return edges[0]?.from ?? edges[0]?.to ?? null;
}

function formatScore(value: number) {
	return value.toFixed(1);
}

export default function TopologyGraph({
	periods,
	impactPeriods,
	getContributorHref,
	contributorRepoKey = null,
	componentsHref = route("/components"),
}: TopologyGraphProps) {
	const resolvedGetContributorHref = useMemo(() => {
		if (typeof getContributorHref === "function") {
			return getContributorHref;
		}

		if (contributorRepoKey) {
			return (email: string) =>
				getLandscapeRepositoryContributorHref(contributorRepoKey, email);
		}

		return (email: string) =>
			getDefaultContributorHref(email, { source: "topology" });
	}, [contributorRepoKey, getContributorHref]);

	const periodKeys = Object.keys(periods);
	const [mountVersion, setMountVersion] = useState(getRouteVersion);
	const initialValues = useMemo(
		() =>
			[
				[topologyPeriodsAtom, periods],
				[selectedPeriodAtom, periodKeys[0] ?? "All Time"],
			] as const,
		[periodKeys, periods],
	);

	useEffect(() => {
		const syncRouteVersion = (event?: Event) => {
			const detailVersion =
				event instanceof CustomEvent &&
				typeof event.detail?.version === "number"
					? event.detail.version
					: null;

			setMountVersion(detailVersion ?? getRouteVersion());
		};

		document.addEventListener(
			"planetnik:route-version",
			syncRouteVersion as EventListener,
		);
		window.addEventListener("pageshow", syncRouteVersion);
		syncRouteVersion();

		return () => {
			document.removeEventListener(
				"planetnik:route-version",
				syncRouteVersion as EventListener,
			);
			window.removeEventListener("pageshow", syncRouteVersion);
		};
	}, []);

	return (
		<RegistryProvider key={mountVersion} initialValues={initialValues}>
			<TopologyGraphContent
				periodKeys={periodKeys}
				impactPeriods={impactPeriods}
				getContributorHref={resolvedGetContributorHref}
				componentsHref={componentsHref}
			/>
		</RegistryProvider>
	);
}

function TopologyGraphContent({
	periodKeys,
	impactPeriods,
	getContributorHref,
	componentsHref,
}: {
	periodKeys: string[];
	impactPeriods: Record<string, ContributorImpactContributor[]>;
	getContributorHref: (email: string) => string;
	componentsHref: string | null;
}) {
	const [selectedPeriod, setSelectedPeriod] = useAtom(selectedPeriodAtom);
	const currentEdges = useAtomValue(currentEdgesAtom);
	const stats = useAtomValue(topologyStatsAtom);
	const sortedEdges = useAtomValue(sortedEdgesAtom);
	const [selectedContributorEmail, setSelectedContributorEmail] = useState<
		string | null
	>(null);
	const [graphActivated, setGraphActivated] = useState(false);
	const graphViewportRef = useRef<HTMLDivElement | null>(null);
	const graphInstanceRef = useRef<ReactFlowHandle | null>(null);
	const fitViewTimeoutRef = useRef<number | null>(null);
	const styleInjected = useRef(false);

	// Inject pulse animation keyframes once
	useEffect(() => {
		if (styleInjected.current) return;
		styleInjected.current = true;
		const style = document.createElement("style");
		style.textContent = pulseKeyframes;
		document.head.appendChild(style);
	}, []);

	const currentImpactContributors = useMemo(
		() => impactPeriods[selectedPeriod] ?? [],
		[impactPeriods, selectedPeriod],
	);
	const graphContributorEmails = useMemo(() => {
		const emails = new Set<string>();
		for (const edge of currentEdges) {
			emails.add(edge.from);
			emails.add(edge.to);
		}
		return emails;
	}, [currentEdges]);
	const contributorImpactMap = useMemo(
		() =>
			new Map(
				currentImpactContributors.map((contributor) => [
					contributor.email,
					contributor,
				]),
			),
		[currentImpactContributors],
	);
	const defaultSelectedContributor = useMemo(
		() =>
			getDefaultSelectedContributor(
				currentEdges,
				currentImpactContributors,
				graphContributorEmails,
			),
		[currentEdges, currentImpactContributors, graphContributorEmails],
	);

	useEffect(() => {
		if (
			!selectedContributorEmail ||
			!graphContributorEmails.has(selectedContributorEmail)
		) {
			setSelectedContributorEmail(defaultSelectedContributor);
		}
	}, [
		defaultSelectedContributor,
		graphContributorEmails,
		selectedContributorEmail,
	]);

	useEffect(() => {
		const element = graphViewportRef.current;
		if (!element || graphActivated || typeof window === "undefined") return;

		const inViewportSoon =
			element.getBoundingClientRect().top <= window.innerHeight + 240;
		if (inViewportSoon || typeof IntersectionObserver === "undefined") {
			setGraphActivated(true);
			return;
		}

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					setGraphActivated(true);
					observer.disconnect();
				}
			},
			{ rootMargin: "240px 0px" },
		);

		observer.observe(element);
		return () => {
			observer.disconnect();
		};
	}, [graphActivated]);

	const selectedContributor = selectedContributorEmail
		? contributorImpactMap.get(selectedContributorEmail)
		: undefined;
	const glueContributors = useMemo(
		() =>
			currentImpactContributors.filter((contributor) => contributor.is_glue),
		[currentImpactContributors],
	);
	const snackingContributors = useMemo(
		() =>
			currentImpactContributors.filter(
				(contributor) => contributor.is_snacking,
			),
		[currentImpactContributors],
	);
	const topGlueContributor = glueContributors[0];
	const topSnackingContributor = [...snackingContributors].sort(
		(left, right) => right.snacking_score - left.snacking_score,
	)[0];

	const structuredTopology = useMemo(
		() => buildStructuredTopologyEdges(currentEdges, selectedContributorEmail),
		[currentEdges, selectedContributorEmail],
	);

	const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
		() =>
			buildGraph(
				structuredTopology.edges,
				contributorImpactMap,
				selectedContributorEmail,
			),
		[contributorImpactMap, selectedContributorEmail, structuredTopology.edges],
	);
	const contributorForceGraph = useMemo(
		() =>
			buildContributorForceGraph(currentEdges, {
				contributorSource: "topology",
			}),
		[currentEdges],
	);

	const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
	const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

	useEffect(() => {
		setNodes(layoutedNodes);
		setEdges(layoutedEdges);
	}, [layoutedNodes, layoutedEdges, setNodes, setEdges]);

	const scheduleFitView = useCallback(() => {
		if (!graphActivated || typeof window === "undefined") return;

		if (fitViewTimeoutRef.current !== null) {
			window.clearTimeout(fitViewTimeoutRef.current);
		}

		fitViewTimeoutRef.current = window.setTimeout(() => {
			graphInstanceRef.current?.fitView({ padding: 0.18, duration: 240 });
			fitViewTimeoutRef.current = null;
		}, 40);
	}, [graphActivated]);

	useEffect(() => {
		return () => {
			if (fitViewTimeoutRef.current !== null && typeof window !== "undefined") {
				window.clearTimeout(fitViewTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!graphActivated) return;
		scheduleFitView();
	}, [graphActivated, scheduleFitView]);

	useEffect(() => {
		if (!graphActivated || typeof ResizeObserver === "undefined") return;

		const element = graphViewportRef.current;
		if (!element) return;

		const observer = new ResizeObserver(() => {
			scheduleFitView();
		});

		observer.observe(element);
		return () => {
			observer.disconnect();
		};
	}, [graphActivated, scheduleFitView]);

	useEffect(() => {
		if (!graphActivated) return;

		const handleRouteRefresh = () => {
			scheduleFitView();
		};

		document.addEventListener("planetnik:route-version", handleRouteRefresh);
		window.addEventListener("pageshow", handleRouteRefresh);

		return () => {
			document.removeEventListener(
				"planetnik:route-version",
				handleRouteRefresh,
			);
			window.removeEventListener("pageshow", handleRouteRefresh);
		};
	}, [graphActivated, scheduleFitView]);

	const onInit = useCallback(
		(instance: ReactFlowHandle) => {
			graphInstanceRef.current = instance;
			scheduleFitView();
		},
		[scheduleFitView],
	);

	const onNodeClick = useCallback((_event: unknown, node: Node) => {
		setSelectedContributorEmail(node.id);
	}, []);

	return (
		<div>
			{/* Summary cards */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
					gap: "1rem",
					marginBottom: "2rem",
				}}
			>
				<div style={cardStyle}>
					<div style={cardValueStyle}>{stats.contributorCount}</div>
					<div style={cardLabelStyle}>Contributors</div>
				</div>
				<div style={cardStyle}>
					<div style={cardValueStyle}>
						{stats.connectionCount.toLocaleString()}
					</div>
					<div style={cardLabelStyle}>Connections</div>
				</div>
				<div style={cardStyle}>
					<div style={cardValueStyle}>{glueContributors.length}</div>
					<div style={cardLabelStyle}>Glue Contributors</div>
				</div>
				<div style={cardStyle}>
					<div style={cardValueStyle}>{snackingContributors.length}</div>
					<div style={cardLabelStyle}>Snacking Risk</div>
				</div>
				<div style={cardStyle}>
					<div
						style={{
							...cardValueStyle,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{stats.mostConnected}
					</div>
					<div style={cardLabelStyle}>
						Most Connected ({stats.maxConnections})
					</div>
				</div>
				<div style={cardStyle}>
					<div
						style={{
							...cardValueStyle,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{topGlueContributor?.display_name || "None"}
					</div>
					<div style={cardLabelStyle}>
						Top Glue (
						{topGlueContributor
							? formatScore(topGlueContributor.glue_score)
							: "0.0"}
						)
					</div>
				</div>
				<div style={cardStyle}>
					<div
						style={{
							...cardValueStyle,
							overflow: "hidden",
							textOverflow: "ellipsis",
							whiteSpace: "nowrap",
						}}
					>
						{topSnackingContributor?.display_name || "None"}
					</div>
					<div style={cardLabelStyle}>
						Snack Risk (
						{topSnackingContributor
							? formatScore(topSnackingContributor.snacking_score)
							: "0.0"}
						)
					</div>
				</div>
			</div>

			{/* Graph section with period selector */}
			<div style={{ marginBottom: "2rem" }}>
				<div
					style={{
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						marginBottom: "0.75rem",
					}}
				>
					<div style={{ display: "grid", gap: "0.35rem" }}>
						<h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
							Contributor Topology
						</h3>
						{structuredTopology.isCapped ? (
							<p
								style={{
									margin: 0,
									color: "var(--color-text-muted)",
									fontSize: "0.84rem",
									lineHeight: 1.5,
								}}
							>
								Structured view is showing the strongest{" "}
								{structuredTopology.edges.length.toLocaleString()} link
								{structuredTopology.edges.length === 1 ? "" : "s"} across{" "}
								{structuredTopology.displayedNodeCount.toLocaleString()} of{" "}
								{structuredTopology.totalNodeCount.toLocaleString()}{" "}
								contributors for responsiveness. The force-directed view below
								keeps the full {currentEdges.length.toLocaleString()}-link
								graph.
							</p>
						) : null}
					</div>
					<select
						value={selectedPeriod}
						onChange={(e) => setSelectedPeriod(e.target.value)}
						style={selectStyle}
					>
						{periodKeys.map((key) => (
							<option key={key} value={key}>
								{key}
							</option>
						))}
					</select>
				</div>
				<div ref={graphViewportRef}>
					{graphActivated ? (
						<div
							style={{
								width: "100%",
								height: "600px",
								background: "var(--color-card)",
								borderRadius: "8px",
								border: "1px solid var(--color-border)",
							}}
						>
							<ReactFlow
								nodes={nodes}
								edges={edges}
								onNodesChange={onNodesChange}
								onEdgesChange={onEdgesChange}
								onNodeClick={onNodeClick}
								onInit={onInit}
								fitView
								minZoom={0.2}
								maxZoom={2}
								proOptions={{ hideAttribution: true }}
							>
								<Background color="var(--color-border)" gap={20} />
							</ReactFlow>
						</div>
					) : (
						<GraphSkeleton />
					)}
				</div>
			</div>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
					gap: "1rem",
					marginBottom: "2rem",
				}}
			>
				<div style={cardStyle}>
					<div
						style={{
							display: "flex",
							alignItems: "flex-start",
							justifyContent: "space-between",
							gap: "0.75rem",
							marginBottom: "1rem",
						}}
					>
						<div style={{ minWidth: 0 }}>
							<h3
								style={{
									fontSize: "1.1rem",
									fontWeight: 600,
									margin: 0,
									marginBottom: "0.35rem",
								}}
							>
								Selected Contributor
							</h3>
							{selectedContributor ? (
								<>
									<div
										style={{
											fontSize: "1.3rem",
											fontWeight: 700,
											color: "var(--color-text)",
											overflow: "hidden",
											textOverflow: "ellipsis",
											whiteSpace: "nowrap",
										}}
									>
										{selectedContributor.display_name ||
											getContributorDisplayName({
												email: selectedContributor.email,
											})}
									</div>
									<div
										style={{
											color: "var(--color-text-muted)",
											fontFamily: '"SF Mono", "Fira Code", monospace',
											fontSize: "0.78rem",
											marginTop: "0.2rem",
											overflowWrap: "anywhere",
										}}
									>
										{selectedContributor.email}
									</div>
								</>
							) : (
								<p style={{ margin: 0, color: "var(--color-text-muted)" }}>
									Select a contributor node to inspect their glue, snacking, and
									structural impact profile.
								</p>
							)}
						</div>
						{selectedContributor ? (
							<a
								href={getContributorHref(selectedContributor.email)}
								style={detailLinkStyle}
							>
								Open contributor detail
							</a>
						) : null}
					</div>

					{selectedContributor ? (
						<>
							<div
								style={{
									display: "flex",
									gap: "0.5rem",
									flexWrap: "wrap",
									marginBottom: "1rem",
								}}
							>
								{selectedContributor.is_glue ? (
									<span style={glueBadgeStyle}>Glue contributor</span>
								) : null}
								{selectedContributor.is_snacking ? (
									<span style={snackingBadgeStyle}>Snacking risk</span>
								) : null}
								<span style={neutralBadgeStyle}>
									{dimensionLabelMap[selectedContributor.dominant_dimension]}
								</span>
							</div>

							<p
								style={{
									margin: "0 0 0.85rem",
									color: "var(--color-text-muted)",
									lineHeight: 1.6,
								}}
							>
								{selectedContributor.reasons.join(" • ")}
							</p>

							<div
								style={{
									display: "grid",
									gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
									gap: "0.85rem",
									marginBottom: "1rem",
								}}
							>
								<div style={miniMetricCardStyle}>
									<div
										style={{
											...miniMetricValueStyle,
											color: "var(--chart-green)",
										}}
									>
										{formatScore(selectedContributor.glue_score)}
									</div>
									<div style={miniMetricLabelStyle}>Glue score</div>
								</div>
								<div style={miniMetricCardStyle}>
									<div
										style={{
											...miniMetricValueStyle,
											color: "var(--chart-orange)",
										}}
									>
										{formatScore(selectedContributor.snacking_score)}
									</div>
									<div style={miniMetricLabelStyle}>Snack risk</div>
								</div>
								<div style={miniMetricCardStyle}>
									<div
										style={{
											...miniMetricValueStyle,
											color: "var(--color-accent)",
										}}
									>
										{formatScore(selectedContributor.structural_impact_score)}
									</div>
									<div style={miniMetricLabelStyle}>Structural impact</div>
								</div>
								<div style={miniMetricCardStyle}>
									<div
										style={{
											...miniMetricValueStyle,
											color: "var(--chart-accent-light)",
										}}
									>
										{formatScore(selectedContributor.visible_activity_score)}
									</div>
									<div style={miniMetricLabelStyle}>Visible activity</div>
								</div>
							</div>
						</>
					) : null}
				</div>

				<div style={cardStyle}>
					<h3
						style={{
							fontSize: "1.1rem",
							fontWeight: 600,
							margin: 0,
							marginBottom: "1rem",
						}}
					>
						Top Components & Reach
					</h3>
					{selectedContributor ? (
						<>
							<div
								style={{
									display: "grid",
									gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
									gap: "0.85rem",
									marginBottom: "1rem",
								}}
							>
								<div style={miniMetricCardStyle}>
									<div style={miniMetricValueStyle}>
										{selectedContributor.collaborator_count}
									</div>
									<div style={miniMetricLabelStyle}>Collaborators</div>
								</div>
								<div style={miniMetricCardStyle}>
									<div style={miniMetricValueStyle}>
										{selectedContributor.shared_files_count.toLocaleString()}
									</div>
									<div style={miniMetricLabelStyle}>Shared file links</div>
								</div>
								<div style={miniMetricCardStyle}>
									<div style={miniMetricValueStyle}>
										{selectedContributor.files_touched.toLocaleString()}
									</div>
									<div style={miniMetricLabelStyle}>Files touched</div>
								</div>
								<div style={miniMetricCardStyle}>
									<div style={miniMetricValueStyle}>
										{selectedContributor.components_touched.toLocaleString()}
									</div>
									<div style={miniMetricLabelStyle}>Components touched</div>
								</div>
							</div>
							<div style={{ display: "grid", gap: "0.7rem" }}>
								{selectedContributor.top_components
									.slice(0, 3)
									.map((component) => (
										<div key={component.name} style={componentRowStyle}>
											<div>
												<div
													style={{
														fontWeight: 600,
														color: "var(--color-text)",
													}}
												>
													{component.name}
												</div>
												<div
													style={{
														color: "var(--color-text-muted)",
														fontSize: "0.82rem",
													}}
												>
													{component.files} files • {component.commits} commits
												</div>
											</div>
											{componentsHref ? (
												<a href={componentsHref} style={secondaryLinkStyle}>
													Components
												</a>
											) : null}
										</div>
									))}
							</div>
						</>
					) : (
						<p
							style={{
								margin: 0,
								color: "var(--color-text-muted)",
								lineHeight: 1.6,
							}}
						>
							Use the graph to inspect where an individual contributor is acting
							as glue, where their work looks narrowly visible, and which
							components they are shaping.
						</p>
					)}
				</div>
			</div>

			<div style={{ marginBottom: "2rem" }}>
				<div
					style={{ display: "grid", gap: "0.4rem", marginBottom: "0.75rem" }}
				>
					<h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
						Force-Directed View
					</h3>
					<p
						style={{
							margin: 0,
							color: "var(--color-text-muted)",
							fontSize: "0.92rem",
						}}
					>
						A second graph view for the same period. Dense clusters surface
						collaboration hotspots, while longer bridges make cross-team touch
						points easier to spot.
					</p>
				</div>
				<ForceGraph
					nodes={contributorForceGraph.nodes}
					edges={contributorForceGraph.edges}
					height={520}
					emptyMessage="Not enough contributor links are available to render the force-directed view for this period."
					helpText={chartHelp.topology.forceGraph}
					footerNote={`Showing ${currentEdges.length.toLocaleString()} contributor link${currentEdges.length === 1 ? "" : "s"} for ${selectedPeriod}.`}
				/>
			</div>

			{/* Strongest connections table */}
			<div style={{ marginBottom: "2rem" }}>
				<h3
					style={{
						fontSize: "1.1rem",
						fontWeight: 600,
						marginBottom: "0.75rem",
					}}
				>
					Strongest Connections
				</h3>
				{graphActivated ? (
					<table style={tableStyle}>
						<thead>
							<tr>
								<th style={thStyle}>Contributor 1</th>
								<th style={thStyle}>Contributor 2</th>
								<th style={{ ...thStyle, textAlign: "right" }}>Shared Files</th>
							</tr>
						</thead>
						<tbody>
							{sortedEdges.map((e) => (
								<tr key={`${e.from}-${e.to}`}>
									<td style={emailStyle}>
										<div style={contributorCellStyle}>
											<a
												href={getContributorHref(e.from)}
												style={emailLinkStyle}
											>
												{e.from}
											</a>
											<div style={chipRowStyle}>
												{contributorImpactMap.get(e.from)?.is_glue ? (
													<span style={glueTableChipStyle}>Glue</span>
												) : null}
												{contributorImpactMap.get(e.from)?.is_snacking ? (
													<span style={snackingTableChipStyle}>Snack</span>
												) : null}
											</div>
										</div>
									</td>
									<td style={emailStyle}>
										<div style={contributorCellStyle}>
											<a href={getContributorHref(e.to)} style={emailLinkStyle}>
												{e.to}
											</a>
											<div style={chipRowStyle}>
												{contributorImpactMap.get(e.to)?.is_glue ? (
													<span style={glueTableChipStyle}>Glue</span>
												) : null}
												{contributorImpactMap.get(e.to)?.is_snacking ? (
													<span style={snackingTableChipStyle}>Snack</span>
												) : null}
											</div>
										</div>
									</td>
									<td style={numStyle}>{e.count}</td>
								</tr>
							))}
						</tbody>
					</table>
				) : (
					<TableSkeleton />
				)}
			</div>
		</div>
	);
}

const cardStyle: React.CSSProperties = {
	background: "var(--color-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "8px",
	padding: "1.25rem",
};

const cardValueStyle: React.CSSProperties = {
	fontSize: "1.75rem",
	fontWeight: 700,
	color: "var(--color-accent)",
	lineHeight: 1,
};

const cardLabelStyle: React.CSSProperties = {
	fontSize: "0.8rem",
	color: "var(--color-text-muted)",
	marginTop: "0.35rem",
	textTransform: "uppercase",
	letterSpacing: "0.04em",
};

const selectStyle: React.CSSProperties = {
	padding: "0.4rem 0.75rem",
	fontSize: "0.85rem",
	border: "1px solid var(--color-border)",
	borderRadius: "6px",
	background: "var(--color-card)",
	color: "var(--color-text)",
	cursor: "pointer",
	outline: "none",
};

const tableStyle: React.CSSProperties = {
	width: "100%",
	borderCollapse: "collapse",
	background: "var(--color-card)",
	border: "1px solid var(--color-border)",
	borderRadius: "8px",
	overflow: "hidden",
};

const thStyle: React.CSSProperties = {
	padding: "0.5rem 0.75rem",
	textAlign: "left",
	borderBottom: "1px solid var(--color-border)",
	background: "var(--color-surface-subtle)",
	fontSize: "0.7rem",
	fontWeight: 600,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
	color: "var(--color-text-muted)",
};

const tdBase: React.CSSProperties = {
	padding: "0.5rem 0.75rem",
	borderBottom: "1px solid var(--color-border)",
	fontSize: "0.85rem",
	color: "var(--color-text)",
};

const emailStyle: React.CSSProperties = {
	...tdBase,
	fontFamily: '"SF Mono", "Fira Code", monospace',
	fontSize: "0.75rem",
	color: "var(--color-text-muted)",
	maxWidth: "min(300px, 40vw)",
	overflow: "hidden",
	textOverflow: "ellipsis",
	whiteSpace: "nowrap",
};

const numStyle: React.CSSProperties = {
	...tdBase,
	textAlign: "right",
	fontFamily: '"SF Mono", "Fira Code", monospace',
};

const emailLinkStyle: React.CSSProperties = {
	color: "var(--color-accent)",
	textDecoration: "none",
};

const detailLinkStyle: React.CSSProperties = {
	display: "inline-flex",
	alignItems: "center",
	justifyContent: "center",
	whiteSpace: "nowrap",
	padding: "0.5rem 0.8rem",
	borderRadius: "999px",
	border: "1px solid var(--color-border)",
	color: "var(--color-text)",
	background: "var(--color-surface-subtle)",
	textDecoration: "none",
	fontSize: "0.82rem",
	fontWeight: 600,
};

const secondaryLinkStyle: React.CSSProperties = {
	...detailLinkStyle,
	padding: "0.4rem 0.65rem",
	fontSize: "0.75rem",
};

const glueBadgeStyle: React.CSSProperties = {
	background: "color-mix(in srgb, var(--chart-green) 22%, transparent)",
	color: "var(--chart-green)",
	border: "1px solid color-mix(in srgb, var(--chart-green) 42%, transparent)",
	borderRadius: "999px",
	padding: "0.28rem 0.55rem",
	fontSize: "0.72rem",
	fontWeight: 700,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
};

const snackingBadgeStyle: React.CSSProperties = {
	background: "color-mix(in srgb, var(--chart-orange) 18%, transparent)",
	color: "var(--chart-orange)",
	border: "1px solid color-mix(in srgb, var(--chart-orange) 38%, transparent)",
	borderRadius: "999px",
	padding: "0.28rem 0.55rem",
	fontSize: "0.72rem",
	fontWeight: 700,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
};

const neutralBadgeStyle: React.CSSProperties = {
	background: "var(--color-surface-subtle)",
	color: "var(--color-text-muted)",
	border: "1px solid var(--color-border)",
	borderRadius: "999px",
	padding: "0.28rem 0.55rem",
	fontSize: "0.72rem",
	fontWeight: 700,
	textTransform: "uppercase",
	letterSpacing: "0.04em",
};

const miniMetricCardStyle: React.CSSProperties = {
	background: "var(--color-surface-subtle)",
	border: "1px solid var(--color-border)",
	borderRadius: "8px",
	padding: "0.85rem 0.9rem",
};

const miniMetricValueStyle: React.CSSProperties = {
	fontSize: "1.45rem",
	fontWeight: 700,
	color: "var(--color-text)",
	lineHeight: 1,
};

const miniMetricLabelStyle: React.CSSProperties = {
	fontSize: "0.72rem",
	color: "var(--color-text-muted)",
	marginTop: "0.4rem",
	textTransform: "uppercase",
	letterSpacing: "0.05em",
};

const componentRowStyle: React.CSSProperties = {
	display: "flex",
	alignItems: "center",
	justifyContent: "space-between",
	gap: "0.75rem",
	background: "var(--color-surface-subtle)",
	border: "1px solid var(--color-border)",
	borderRadius: "8px",
	padding: "0.75rem 0.9rem",
};

const contributorCellStyle: React.CSSProperties = {
	display: "grid",
	gap: "0.35rem",
};

const chipRowStyle: React.CSSProperties = {
	display: "flex",
	gap: "0.35rem",
	flexWrap: "wrap",
};

const glueTableChipStyle: React.CSSProperties = {
	...glueBadgeStyle,
	padding: "0.18rem 0.42rem",
	fontSize: "0.64rem",
};

const snackingTableChipStyle: React.CSSProperties = {
	...snackingBadgeStyle,
	padding: "0.18rem 0.42rem",
	fontSize: "0.64rem",
};
