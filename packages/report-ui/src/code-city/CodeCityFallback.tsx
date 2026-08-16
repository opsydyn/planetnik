import type { buildCodeCityFallbackRows } from "./viewModel.js";
import { useState } from "react";

export type CodeCityFallbackRow = ReturnType<typeof buildCodeCityFallbackRows>[number];

export type CodeCityFallbackProps = {
	readonly rows: readonly CodeCityFallbackRow[];
	readonly status: string | null;
	readonly primary: boolean;
	readonly selectionLabel: string | null;
	readonly selectedRowIds: readonly string[];
	readonly onSelect: (id: string) => void;
};

export function formatCodeCityFallbackInspectLabel(
	row: CodeCityFallbackRow,
): string {
	return row.kind === "district"
		? `Inspect district ${row.entity}`
		: `Inspect file ${row.entity}`;
}

export function CodeCityFallback({
	rows,
	status,
	primary,
	selectionLabel,
	selectedRowIds,
	onSelect,
}: CodeCityFallbackProps) {
	const [selectionFilterEnabled, setSelectionFilterEnabled] = useState(false);
	const selectedIds = new Set(selectedRowIds);
	const hasSelectionFilter = selectionLabel !== null && selectedIds.size > 0;
	const visibleRows =
		selectionFilterEnabled && hasSelectionFilter
			? rows.filter((row) => selectedIds.has(row.id))
			: rows;

	return (
		<section
			id="code-city-fallback"
			className={`code-city-fallback${primary ? " code-city-fallback--primary" : " code-city-fallback--supplemental"}`}
			aria-labelledby="code-city-fallback-title"
		>
			<div className="code-city-fallback__heading">
				<h2 id="code-city-fallback-title">Code City table</h2>
				{status ? <p role="status">{status}</p> : null}
				{hasSelectionFilter ? (
					<div className="code-city-fallback__filter">
						<p>
							Selection filter: <strong>{selectionLabel}</strong>. {selectionFilterEnabled
								? `Showing ${visibleRows.length} selected ${visibleRows.length === 1 ? "entity" : "entities"}.`
								: `All ${rows.length} entities remain visible.`}
						</p>
						<button
							type="button"
							aria-pressed={selectionFilterEnabled}
							onClick={() => setSelectionFilterEnabled((enabled) => !enabled)}
						>
							{selectionFilterEnabled ? "Show all entities" : "Show selected entities"}
						</button>
					</div>
				) : null}
			</div>
			<div className="code-city-fallback__scroll">
				<table>
					<caption>Every district and building in the Code City snapshot</caption>
					<thead>
						<tr>
							<th scope="col">Entity</th>
							<th scope="col">District</th>
							<th scope="col">Path / kind</th>
							<th scope="col">LOC</th>
							<th scope="col">Health</th>
							<th scope="col">Impact</th>
							<th scope="col">Evidence</th>
						</tr>
					</thead>
					<tbody>
						{visibleRows.map((row) => (
							<tr key={row.id}>
								<th scope="row">{row.entity}</th>
								<td>{row.district}</td>
								<td>
									<code>{row.path}</code>
								</td>
								<td>{row.loc}</td>
								<td>{row.health}</td>
								<td>{row.impact}</td>
								<td>
									<div className="code-city-fallback__actions">
										{row.href ? <a href={row.href}>View evidence</a> : <span>Unavailable</span>}
										<button
											type="button"
											onClick={() => onSelect(row.id)}
											aria-label={formatCodeCityFallbackInspectLabel(row)}
										>
											Inspect
										</button>
									</div>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	);
}

export default CodeCityFallback;
