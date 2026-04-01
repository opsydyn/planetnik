export class ReportUtils {
	static getSvgBar(value: number, maxValue: number, color: string): string {
		const effectiveMax = Math.max(value, maxValue);
		const width = 200;
		return (
			`<svg width='${width}' y='15' height='20'>` +
			`<rect fill='lightgrey' width='${width}' height='30'/>` +
			`<rect fill='${color}' width='${Math.max(1, Math.floor((width * value) / effectiveMax))}' height='30'/>` +
			"</svg>"
		);
	}

	static getSvgCircle(color: string): string {
		return `<svg height="22" width="22">\n<circle cx="11" cy="11" r="10" fill="${color}" /></svg>`;
	}

	static formatNumber(value: number): string {
		if (Number.isNaN(value) || !Number.isFinite(value)) return "-";
		return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
	}
}
