import { useState } from "react";
import type { ForceGraphEdge, ForceGraphNode } from "../lib/forceGraph";
import ForceGraph from "./graphs/ForceGraph";

interface Connection {
	from: string;
	to: string;
	sharedFilesCount: number;
	sharedFiles: string[];
}

interface MostConnectedContributor {
	email: string;
	displayName: string;
	connectionCount: number;
}

interface TopologyPeriod {
	periodKey: string;
	periodLabel: string;
	contributorCount: number;
	connectionCount: number;
	cMean: number;
	mostConnectedContributor: MostConnectedContributor | null;
	strongestConnections: Connection[];
}

interface TopologySection {
	periodKey: string;
	periodLabel: string;
	connectionCount: number;
	period: TopologyPeriod;
	nodes: ForceGraphNode[];
	edges: ForceGraphEdge[];
	isTrimmed: boolean;
	visibleCount: number;
}

interface LandscapeTopologyExplorerProps {
	sections: TopologySection[];
	helpText?: string;
}

export default function LandscapeTopologyExplorer({
	sections,
	helpText,
}: LandscapeTopologyExplorerProps) {
	const [selectedKey, setSelectedKey] = useState(
		sections[0]?.periodKey ?? "all_time",
	);
	const selected =
		sections.find((s) => s.periodKey === selectedKey) ?? sections[0];

	if (!selected) {
		return (
			<div className="topo-empty">
				<p>No landscape topology data was exported.</p>
			</div>
		);
	}

	const { period } = selected;

	return (
		<div className="topo-explorer">
			<div className="topo-periods">
				{sections.map((section) => (
					<button
						key={section.periodKey}
						type="button"
						className={`topo-period-btn${section.periodKey === selectedKey ? " active" : ""}`}
						onClick={() => setSelectedKey(section.periodKey)}
					>
						{section.periodLabel}
						<span className="topo-period-count">
							{section.connectionCount.toLocaleString()}
						</span>
					</button>
				))}
			</div>

			<div className="topo-cards">
				<div className="topo-card">
					<div className="topo-card-value">
						{period.contributorCount.toLocaleString()}
					</div>
					<div className="topo-card-label">Contributors</div>
				</div>
				<div className="topo-card">
					<div className="topo-card-value">
						{period.connectionCount.toLocaleString()}
					</div>
					<div className="topo-card-label">Connections</div>
				</div>
				<div className="topo-card">
					<div className="topo-card-value">{period.cMean.toFixed(1)}</div>
					<div className="topo-card-label">Mean Coordination</div>
				</div>
				<div className="topo-card">
					<div className="topo-card-value">
						{period.mostConnectedContributor?.displayName ?? "—"}
					</div>
					<div className="topo-card-label">Most Connected</div>
				</div>
			</div>

			<section className="topo-section">
				<h3>Collaboration Graph</h3>
				{selected.isTrimmed ? (
					<p className="topo-hint">
						Visualizing the strongest {selected.visibleCount.toLocaleString()}{" "}
						of {period.connectionCount.toLocaleString()} links to keep the graph
						responsive.
					</p>
				) : null}
				<ForceGraph
					nodes={selected.nodes}
					edges={selected.edges}
					helpText={helpText}
					footerNote={
						selected.isTrimmed
							? `Showing the strongest ${selected.visibleCount.toLocaleString()} of ${period.connectionCount.toLocaleString()} cross-repository contributor links in ${period.periodLabel}.`
							: `Showing ${period.connectionCount.toLocaleString()} cross-repository contributor links in ${period.periodLabel}.`
					}
				/>
			</section>

			<section className="topo-section">
				<h3>Strongest Connections</h3>
				<div className="topo-table-wrap">
					<table className="topo-table">
						<thead>
							<tr>
								<th>Contributor 1</th>
								<th>Contributor 2</th>
								<th>Shared Files</th>
							</tr>
						</thead>
						<tbody>
							{period.strongestConnections.slice(0, 25).map((connection) => (
								<tr key={`${connection.from}-${connection.to}`}>
									<td>
										<code>{connection.from}</code>
									</td>
									<td>
										<code>{connection.to}</code>
									</td>
									<td className="topo-num">
										{connection.sharedFilesCount.toLocaleString()}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</section>
		</div>
	);
}
