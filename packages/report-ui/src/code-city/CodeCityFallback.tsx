import type { buildCodeCityFallbackRows } from "./viewModel.js";

export type CodeCityFallbackRow = ReturnType<typeof buildCodeCityFallbackRows>[number];

export type CodeCityFallbackProps = {
	readonly rows: readonly CodeCityFallbackRow[];
	readonly status: string | null;
	readonly primary: boolean;
	readonly onSelect: (id: string) => void;
};

export function CodeCityFallback({
	rows,
	status,
	primary,
	onSelect,
}: CodeCityFallbackProps) {
	return (
		<section
			id="code-city-fallback"
			className={`code-city-fallback${primary ? " code-city-fallback--primary" : " code-city-fallback--supplemental"}`}
			aria-labelledby="code-city-fallback-title"
		>
			<div className="code-city-fallback__heading">
				<h2 id="code-city-fallback-title">Code City table</h2>
				{status ? <p role="status">{status}</p> : null}
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
						{rows.map((row) => (
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
