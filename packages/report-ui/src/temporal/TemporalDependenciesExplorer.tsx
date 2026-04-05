import {
	startTransition,
	useDeferredValue,
	useId,
	useMemo,
	useState,
} from "react";
import { buildTemporalForceGraph } from "../topology/forceGraph.js";
import HorizontalBarChart from "../charts/HorizontalBarChart.js";
import ForceGraph from "../topology/graphs/ForceGraph.js";
import ReportDataGrid from "../tables/ReportDataGrid.js";
import "./TemporalDependenciesExplorer.css";

type TemporalDependencyRow = {
	periodKey: string;
	periodLabel: string;
	periodDays: number;
	file1: string;
	file2: string;
	sameCommits: number;
	commitsFile1: number;
	commitsFile2: number;
	latestCommit: string;
};

type TemporalDependencySection = {
	periodKey: string;
	periodLabel: string;
	periodDays: number;
	dependencies: TemporalDependencyRow[];
};

type TemporalDependenciesExplorerProps = {
	sections: TemporalDependencySection[];
};

const ALL_PERIODS_KEY = "all_periods";

function shortPath(path: string): string {
	const parts = path.split("/");
	return parts.length > 2 ? `.../${parts.slice(-2).join("/")}` : path;
}

function getOverlapPercent(row: TemporalDependencyRow): number {
	const baseline = Math.min(row.commitsFile1, row.commitsFile2);
	if (baseline <= 0) return 0;
	return Math.round((row.sameCommits / baseline) * 100);
}

function matchesQuery(row: TemporalDependencyRow, query: string): boolean {
	if (!query) return true;

	const haystack = [
		row.periodLabel,
		row.file1,
		row.file2,
		row.latestCommit,
		String(row.sameCommits),
		String(row.commitsFile1),
		String(row.commitsFile2),
	]
		.join(" ")
		.toLowerCase();

	return haystack.includes(query);
}

function sortRows(rows: TemporalDependencyRow[]): TemporalDependencyRow[] {
	return [...rows].sort((left, right) => {
		if (left.sameCommits !== right.sameCommits) {
			return right.sameCommits - left.sameCommits;
		}

		if (left.latestCommit !== right.latestCommit) {
			return right.latestCommit.localeCompare(left.latestCommit);
		}

		const file1Comparison = left.file1.localeCompare(right.file1);
		if (file1Comparison !== 0) {
			return file1Comparison;
		}

		return left.file2.localeCompare(right.file2);
	});
}

export default function TemporalDependenciesExplorer({
	sections,
}: TemporalDependenciesExplorerProps) {
	const allRows = sections.flatMap((section) => section.dependencies);
	const allPeriodsSection: TemporalDependencySection = {
		periodKey: ALL_PERIODS_KEY,
		periodLabel: "All Periods",
		periodDays: 0,
		dependencies: allRows,
	};
	const availableSections = [allPeriodsSection, ...sections];

	const [selectedPeriod, setSelectedPeriod] = useState<string>(
		availableSections[0]?.periodKey ?? ALL_PERIODS_KEY,
	);
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query.trim().toLowerCase());
	const searchInputId = useId();

	const activeSection =
		availableSections.find((section) => section.periodKey === selectedPeriod) ??
		allPeriodsSection;
	const activeRows = sortRows(activeSection.dependencies);
	const filteredRows = deferredQuery
		? activeRows.filter((row) => matchesQuery(row, deferredQuery))
		: activeRows;
	const temporalForceGraph = useMemo(
		() => buildTemporalForceGraph(filteredRows),
		[filteredRows],
	);

	const uniqueFiles = new Set(
		filteredRows.flatMap((row) => [row.file1, row.file2]),
	).size;
	const strongestPair = filteredRows[0] ?? null;
	const averageSharedCommits =
		filteredRows.length > 0
			? Math.round(
					(filteredRows.reduce((sum, row) => sum + row.sameCommits, 0) /
						filteredRows.length) *
						10,
				) / 10
			: 0;
	const latestCommit =
		filteredRows.reduce(
			(latest, row) => (row.latestCommit > latest ? row.latestCommit : latest),
			"",
		) || "—";

	const pairChartData = filteredRows.slice(0, 12).map((row) => ({
		label: `${shortPath(row.file1)} ↔ ${shortPath(row.file2)}`,
		value: row.sameCommits,
	}));

	const fileHotspotMap = new Map<string, number>();
	for (const row of filteredRows) {
		fileHotspotMap.set(
			row.file1,
			(fileHotspotMap.get(row.file1) ?? 0) + row.sameCommits,
		);
		fileHotspotMap.set(
			row.file2,
			(fileHotspotMap.get(row.file2) ?? 0) + row.sameCommits,
		);
	}
	const hotspotChartData = [...fileHotspotMap.entries()]
		.sort((left, right) => right[1] - left[1])
		.slice(0, 12)
		.map(([path, value]) => ({
			label: shortPath(path),
			value,
		}));

	return (
		<div className="temporal-explorer">
			<div className="temporal-toolbar">
				<div
					className="temporal-periods"
					role="tablist"
					aria-label="Temporal dependency periods"
				>
					{availableSections.map((section) => {
						const isActive = section.periodKey === selectedPeriod;
						return (
							<button
								key={section.periodKey}
								type="button"
								role="tab"
								aria-selected={isActive}
								className={`temporal-period-pill${isActive ? " is-active" : ""}`}
								onClick={() =>
									startTransition(() => {
										setSelectedPeriod(section.periodKey);
									})
								}
							>
								<span>{section.periodLabel}</span>
								<strong>{section.dependencies.length}</strong>
							</button>
						);
					})}
				</div>

				<div className="temporal-search">
					<label htmlFor={searchInputId}>Search file pairs</label>
					<input
						id={searchInputId}
						type="search"
						value={query}
						placeholder="Filter by file path, period, date, or count"
						onChange={(event) =>
							startTransition(() => {
								setQuery(event.target.value);
							})
						}
					/>
					<p>
						Search matches the full file paths, period labels, dates, and commit
						counts in the visible dataset.
					</p>
				</div>
			</div>

			<div className="temporal-summary-grid">
				<article className="temporal-summary-card">
					<span>Visible Pairs</span>
					<strong>{filteredRows.length.toLocaleString()}</strong>
					<small>
						out of {activeRows.length.toLocaleString()} in{" "}
						{activeSection.periodLabel}
					</small>
				</article>
				<article className="temporal-summary-card">
					<span>Unique Files</span>
					<strong>{uniqueFiles.toLocaleString()}</strong>
					<small>files participating in the filtered pairs</small>
				</article>
				<article className="temporal-summary-card">
					<span>Strongest Pair</span>
					<strong>
						{strongestPair ? strongestPair.sameCommits.toLocaleString() : "0"}
					</strong>
					<small>
						{strongestPair
							? `${shortPath(strongestPair.file1)} ↔ ${shortPath(strongestPair.file2)}`
							: "No matching pairs"}
					</small>
				</article>
				<article className="temporal-summary-card">
					<span>Latest Commit</span>
					<strong>{latestCommit}</strong>
					<small>
						average shared commits {averageSharedCommits.toLocaleString()}
					</small>
				</article>
			</div>

			<section className="temporal-force-section">
				<div className="temporal-force-header">
					<h3>Force-Directed File Couplings</h3>
					<p>
						Dense clusters show files that travel together through the current
						filtered dataset. The graph updates with the same period and search
						controls as the table.
					</p>
				</div>
				<ForceGraph
					nodes={temporalForceGraph.nodes}
					edges={temporalForceGraph.edges}
					height={520}
					emptyMessage="Not enough matching file couplings to render a force graph for the current filter."
					helpText="Shows files that tend to change together in the current period and search scope. Tight clusters are good candidates for co-locating, simplifying, or extracting behind clearer boundaries."
					footerNote={`Showing ${filteredRows.length.toLocaleString()} filtered pair${filteredRows.length === 1 ? "" : "s"} in ${activeSection.periodLabel}.`}
				/>
			</section>

			<div className="temporal-chart-grid">
				<section className="temporal-chart-panel">
					<h3>Strongest Couplings</h3>
					<p>The highest shared-commit pairs in the current view.</p>
					{pairChartData.length > 0 ? (
						<HorizontalBarChart
							data={pairChartData}
							valueLabel="shared commits"
							maxItems={12}
							helpText="Ranks the pairs with the highest shared-commit overlap. Start here when you want concrete coupling evidence for refactoring discussions."
						/>
					) : (
						<div className="temporal-chart-empty">
							No pairs match the current search.
						</div>
					)}
				</section>
				<section className="temporal-chart-panel">
					<h3>Hotspot Files</h3>
					<p>Files that appear most often across the current coupling set.</p>
					{hotspotChartData.length > 0 ? (
						<HorizontalBarChart
							data={hotspotChartData}
							valueLabel="shared commits"
							maxItems={12}
							barColor="#8b5cf6"
							helpText="Ranks files that appear across the most coupling pairs. These files often act as coordination magnets and deserve boundary or ownership review."
						/>
					) : (
						<div className="temporal-chart-empty">
							No files match the current search.
						</div>
					)}
				</section>
			</div>

			<section className="temporal-table-section">
				<ReportDataGrid
					title="Searchable Pair Table"
					description="Every filtered row remains available on this page. Use search plus period filters to narrow it down."
					searchEnabled={false}
					emptyMessage="No temporal dependency rows match the current search."
					paginationPageSize={25}
					columns={[
						{ field: "periodLabel", headerName: "Period", minWidth: 160 },
						{
							field: "file1",
							headerName: "File 1",
							type: "path",
							minWidth: 280,
							flex: 1.2,
						},
						{
							field: "file2",
							headerName: "File 2",
							type: "path",
							minWidth: 280,
							flex: 1.2,
						},
						{
							field: "sameCommits",
							headerName: "Shared",
							type: "number",
							minWidth: 120,
							sort: "desc",
						},
						{
							field: "overlap",
							headerName: "Overlap",
							type: "percent",
							minWidth: 120,
						},
						{
							field: "commitsFile1",
							headerName: "Commits 1",
							type: "number",
							minWidth: 130,
						},
						{
							field: "commitsFile2",
							headerName: "Commits 2",
							type: "number",
							minWidth: 130,
						},
						{
							field: "latestCommit",
							headerName: "Latest",
							type: "date",
							minWidth: 140,
						},
					]}
					rows={filteredRows.map((row) => ({
						id: `${row.periodKey}:${row.file1}:${row.file2}`,
						periodLabel: row.periodLabel,
						file1: row.file1,
						file2: row.file2,
						sameCommits: row.sameCommits,
						overlap: getOverlapPercent(row),
						commitsFile1: row.commitsFile1,
						commitsFile2: row.commitsFile2,
						latestCommit: row.latestCommit,
					}))}
				/>
			</section>
		</div>
	);
}
