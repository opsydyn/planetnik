import type { CodeCityInspectorModel } from "./viewModel.js";

export type CodeCityInspectorProps = {
	readonly inspector: CodeCityInspectorModel | null;
	readonly canFocus: boolean;
	readonly onFocus: () => void;
	readonly onClear: () => void;
};

export function CodeCityInspector({
	inspector,
	canFocus,
	onFocus,
	onClear,
}: CodeCityInspectorProps) {
	return (
		<aside className="code-city-inspector" aria-labelledby="code-city-inspector-title">
			<h2 id="code-city-inspector-title">Inspector</h2>
			{inspector ? (
				<>
					<div className="code-city-inspector__identity">
						<h3>{inspector.title}</h3>
						{inspector.path ? <code>{inspector.path}</code> : null}
					</div>

					<dl className="code-city-inspector__context">
						<div>
							<dt>District</dt>
							<dd>{inspector.districtLabel ?? "Unavailable"}</dd>
						</div>
						<div>
							<dt>Source set</dt>
							<dd>
								{inspector.sourceSets.length > 0
									? inspector.sourceSets.join(", ")
									: "Unavailable"}
							</dd>
						</div>
					</dl>

					<dl className="code-city-inspector__metrics">
						{inspector.metrics.map((metric) => (
							<div key={metric.label}>
								<dt>{metric.label}</dt>
								<dd>{metric.value}</dd>
							</div>
						))}
					</dl>

					{inspector.evidence.length > 0 ? (
						<section className="code-city-inspector__evidence" aria-labelledby="code-city-evidence-title">
							<h3 id="code-city-evidence-title">Evidence</h3>
							<ul>
								{inspector.evidence.map((evidence) => (
									<li key={`${evidence.label}:${evidence.href}`}>
										<a href={evidence.href}>{evidence.label}</a>
									</li>
								))}
							</ul>
						</section>
					) : (
						<p className="code-city-inspector__empty">No linked evidence is available.</p>
					)}

					{inspector.units.length > 0 ? (
						<section className="code-city-inspector__units" aria-labelledby="code-city-units-title">
							<h3 id="code-city-units-title">Units</h3>
							<ol>
								{inspector.units.map((unit) => (
									<li key={unit.id}>
										<strong>{unit.label}</strong>
										<code>{unit.id}</code>
										<p>
											{unit.range} · {unit.loc} LOC · {unit.complexity}
										</p>
										{unit.evidence.length > 0 ? (
											<ul>
												{unit.evidence.map((evidence) => (
													<li key={`${evidence.label}:${evidence.href}`}>
														<a href={evidence.href}>{evidence.label}</a>
													</li>
												))}
											</ul>
										) : (
											<span>Unit evidence unavailable</span>
										)}
									</li>
								))}
							</ol>
						</section>
					) : null}

					<div className="code-city-inspector__actions">
						<button type="button" onClick={onFocus} disabled={!canFocus}>
							Focus
						</button>
						<button type="button" onClick={onClear}>
							Clear selection
						</button>
					</div>
				</>
			) : (
				<p className="code-city-inspector__empty">
					Select a district or building on the map, or inspect one from the table.
				</p>
			)}
		</aside>
	);
}

export default CodeCityInspector;
