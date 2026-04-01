import type { ComponentDependency } from "@planetnik/analyzer";

export interface ComponentGroup {
	name: string;
	componentNames: string[];
}

export class GraphvizDependencyRenderer {
	orientation = "TB";
	private body = "";
	private type = "digraph";
	private arrow = "->";
	arrowColor = "#00688b";
	cyclicArrowColor = "#DC143C";
	defaultNodeFillColor = "grey";
	maxNumberOfDependencies = 0;
	reverseDirection = false;

	static encodeLabel(label: string): string {
		return label
			.replace(/\\/g, "\\\\")
			.replace(/"/g, '\\"')
			.replace(/\t/g, " ");
	}

	getGraphvizContent(
		allComponents: string[],
		componentDependencies: ComponentDependency[],
		groups: ComponentGroup[] = [],
	): string {
		const maxCount = GraphvizDependencyRenderer.getMaxDependencyCount(
			componentDependencies,
		);
		let graphviz = this.getHeader();

		graphviz += "\n";
		for (const c of allComponents) {
			if (c) {
				graphviz += `    "${GraphvizDependencyRenderer.encodeLabel(c)}" [fillcolor="deepskyblue2"];\n`;
			}
		}
		graphviz += "\n";

		let clusterId = 0;
		graphviz += "\n";
		for (const g of groups) {
			if (g.name) {
				clusterId += 1;
				graphviz += `    subgraph cluster_${clusterId} {\n`;
				graphviz += `        label = "${GraphvizDependencyRenderer.encodeLabel(`${g.name} (${g.componentNames.length})`)}";\n`;
				for (const c of g.componentNames) {
					if (c) {
						graphviz += `        "${GraphvizDependencyRenderer.encodeLabel(c)}";\n`;
					}
				}
				graphviz += "    }\n";
			}
		}
		graphviz += "\n";

		let renderDeps = [...componentDependencies];
		renderDeps.sort((a, b) => b.count - a.count);

		if (
			this.maxNumberOfDependencies > 0 &&
			renderDeps.length > this.maxNumberOfDependencies
		) {
			renderDeps = renderDeps.slice(0, this.maxNumberOfDependencies);
		}

		for (const dep of renderDeps) {
			if (!dep.fromComponent || !dep.toComponent) continue;
			const thickness = GraphvizDependencyRenderer.getThickness(dep, maxCount);
			let color = dep.color || "";
			if (!color) {
				color = GraphvizDependencyRenderer.isCyclic(componentDependencies, dep)
					? this.cyclicArrowColor
					: this.arrowColor;
			}
			const transparency = Math.floor(255 * (0.3 + (0.7 * thickness) / 10.0));
			const colorWithAlpha =
				color + transparency.toString(16).padStart(2, "0").toUpperCase();
			const from = this.reverseDirection ? dep.toComponent : dep.fromComponent;
			const to = this.reverseDirection ? dep.fromComponent : dep.toComponent;
			graphviz += `    "${GraphvizDependencyRenderer.encodeLabel(from)}" ${this.arrow} "${GraphvizDependencyRenderer.encodeLabel(to)}"`;
			graphviz += ` [label=" ${GraphvizDependencyRenderer.encodeLabel(GraphvizDependencyRenderer.getLabel(dep))}`;
			graphviz += ` ", penwidth="${Math.max(1, thickness)}", color="${colorWithAlpha}"];\n`;
		}

		graphviz += "\n}";
		return graphviz;
	}

	append(text: string): void {
		this.body += text;
	}

	getHtmlContent(): string {
		return `${REPORTS_HTML_HEADER}\n<body><div id="report">\n\n${this.body}</div>\n</body>\n</html>`;
	}

	setTypeGraph(): void {
		this.type = "graph";
		this.arrow = "--";
	}

	setTypeDigraph(): void {
		this.type = "digraph";
		this.arrow = "->";
	}

	private getHeader(): string {
		return (
			`${this.type} G {\n` +
			'    compound="true"\n' +
			`    rankdir="${this.orientation}"\n` +
			'    bgcolor="white"\n' +
			'    fontname="Tahoma"\n\n' +
			"    node [\n" +
			'        fixedsize="false"\n' +
			'        fontname="Tahoma"\n' +
			'        color="white"\n' +
			`        fillcolor="${this.defaultNodeFillColor}"\n` +
			'        fontcolor="black"\n' +
			'        shape="box"\n' +
			'        style="filled"\n' +
			'        penwidth="1.0"\n' +
			"    ]\n" +
			"    edge [\n" +
			'        fontname="Arial"\n' +
			`        color="${this.arrowColor}"\n` +
			'        fontcolor="black"\n' +
			'        fontsize="12"\n' +
			'        arrowsize="0.5"\n' +
			'        penwidth="1.0"\n' +
			"    ]\n"
		);
	}

	private static getThickness(
		dep: ComponentDependency,
		maxCount: number,
	): number {
		if (maxCount <= 10) return dep.count;
		return Math.floor((10.0 * dep.count) / maxCount);
	}

	private static getLabel(dep: ComponentDependency): string {
		return `${dep.count}`;
	}

	private static isCyclic(
		deps: ComponentDependency[],
		dep: ComponentDependency,
	): boolean {
		return deps.some(
			(d) =>
				d.fromComponent === dep.toComponent &&
				d.toComponent === dep.fromComponent,
		);
	}

	private static getMaxDependencyCount(deps: ComponentDependency[]): number {
		let max = 0;
		for (const d of deps) {
			max = Math.max(max, d.count);
		}
		return max;
	}
}

const REPORTS_HTML_HEADER = `<!DOCTYPE html>
<html lang="en">
<head>
    <style type="text/css" media="screen">
        body {
            font-family: Roboto, Optima, Segoe, Segoe UI, Candara, Calibri, Arial, sans-serif;
        }
    </style>
</head>`;
