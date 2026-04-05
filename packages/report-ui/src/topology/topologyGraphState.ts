// ADR-0004: Limited Effect Atom trial for topology page UI state.
import { Atom } from "@effect-atom/atom-react";

export interface PeopleDep {
	from: string;
	to: string;
	count: number;
	files: string[];
}

export interface TopologyStats {
	contributorCount: number;
	connectionCount: number;
	mostConnected: string;
	maxConnections: number;
}

interface MostConnected {
	email: string;
	count: number;
}

const emptyMostConnected: MostConnected = {
	email: "",
	count: 0,
};

const getMostConnected = (
	connectionCounts: ReadonlyMap<string, number>,
): MostConnected =>
	Array.from(connectionCounts.entries()).reduce<MostConnected>(
		(best, [email, count]) => (count > best.count ? { email, count } : best),
		emptyMostConnected,
	);

export const topologyPeriodsAtom = Atom.make<Record<string, PeopleDep[]>>({});

export const selectedPeriodAtom = Atom.make("All Time");

export const currentEdgesAtom = Atom.make((get) => {
	const periods = get(topologyPeriodsAtom);
	const selectedPeriod = get(selectedPeriodAtom);
	return periods[selectedPeriod] ?? [];
});

export const topologyStatsAtom = Atom.make((get): TopologyStats => {
	const edges = get(currentEdgesAtom);
	const contributorSet = new Set<string>();
	const connectionCounts = new Map<string, number>();

	for (const edge of edges) {
		contributorSet.add(edge.from);
		contributorSet.add(edge.to);
		connectionCounts.set(edge.from, (connectionCounts.get(edge.from) ?? 0) + 1);
		connectionCounts.set(edge.to, (connectionCounts.get(edge.to) ?? 0) + 1);
	}

	const { email: mostConnected, count: maxConnections } =
		getMostConnected(connectionCounts);

	return {
		contributorCount: contributorSet.size,
		connectionCount: edges.length,
		mostConnected: mostConnected.split("@")[0] ?? mostConnected,
		maxConnections,
	};
});

export const sortedEdgesAtom = Atom.make((get) => {
	const edges = get(currentEdgesAtom);
	return [...edges].sort((a, b) => b.count - a.count).slice(0, 30);
});
