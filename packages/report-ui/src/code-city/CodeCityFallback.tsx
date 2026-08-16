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
								? `Showing ${visibleRows.length} selected ${visibleRows.length === 1 ? "building" : "buildings"}.`
								: `All ${rows.length} buildings remain visible.`}
						</p>
						<button
							type="button"
							aria-pressed={selectionFilterEnabled}
							onClick={() => setSelectionFilterEnabled((enabled) => !enabled)}
						>
							{selectionFilterEnabled ? "Show all buildings" : "Show selected buildings"}
						</button>
					</div>
				) : null}
			</div>
			<div className="code-city-fallback__scroll">
				<table>
					<caption>Every building in the Code City snapshot</caption>
					<thead>
						<tr>
							<th scope="col">District</th>
							<th scope="col">File path</th>
							<th scope="col">LOC</th>
							<th scope="col">Health</th>
							<th scope="col">Impact</th>
							<th scope="col">Evidence</th>
						</tr>
					</thead>
					<tbody>
						{visibleRows.map((row) => (
							<tr key={row.id}>
								<td>{row.district}</td>
								<th scope="row">
									<code>{row.path}</code>
								</th>
								<td>{row.loc}</td>
								<td>{row.health}</td>
								<td>{row.impact}</td>
								<td>
									<div className="code-city-fallback__actions">
										{row.href ? <a href={row.href}>View evidence</a> : <span>Unavailable</span>}
										<button
											type="button"
											onClick={() => onSelect(row.id)}
											aria-label={`Inspect ${row.path}`}
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
