import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { useTooltip, useTooltipInPortal } from "@visx/tooltip";
import ChartCard from "./ChartCard";
import { chartTheme } from "./theme";

export interface DependencyLink {
	from: string;
	to: string;
	count: number;
}

interface DependencyMatrixProps {
	data: DependencyLink[];
	helpText?: string;
}

const LABEL_SIZE = 11;
const CELL_SIZE = 36;
const LABEL_AREA = 120;

function truncate(s: string, max: number): string {
	return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export default function DependencyMatrix({
	data,
	helpText,
}: DependencyMatrixProps) {
	const names = Array.from(new Set(data.flatMap((d) => [d.from, d.to]))).sort();
	const n = names.length;
	if (n === 0) return null;

	const size = LABEL_AREA + n * CELL_SIZE;
	const cardProps = helpText ? { height: size, helpText } : { height: size };

	return (
		<ChartCard {...cardProps}>
			{(width) => (
				<MatrixInner
					data={data}
					names={names}
					width={Math.max(width, size)}
					size={size}
				/>
			)}
		</ChartCard>
	);
}

function MatrixInner({
	data,
	names,
	width,
	size,
}: {
	data: DependencyLink[];
	names: string[];
	width: number;
	size: number;
}) {
	const {
		tooltipOpen,
		tooltipLeft,
		tooltipTop,
		tooltipData,
		showTooltip,
		hideTooltip,
	} = useTooltip<{ from: string; to: string; count: number }>();
	const { containerRef, TooltipInPortal } = useTooltipInPortal({
		detectBounds: true,
		scroll: true,
	});

	const n = names.length;
	const nameIndex = new Map(names.map((name, i) => [name, i]));

	const matrix: number[][] = Array.from({ length: n }, () => Array<number>(n).fill(0));
	for (const d of data) {
		const ri = nameIndex.get(d.from);
		const ci = nameIndex.get(d.to);
		if (ri != null && ci != null) {
			const row = matrix[ri];
			if (row) row[ci] = d.count;
		}
	}

	const maxCount = Math.max(...data.map((d) => d.count), 1);
	const colorScale = scaleLinear({
		domain: [0, maxCount * 0.33, maxCount],
		range: ["#f1f5f9", "#818cf8", "#4338ca"],
	});

	return (
		<div ref={containerRef} style={{ position: "relative", overflowX: "auto" }}>
			<svg
				width={Math.max(width, size)}
				height={size}
				role="img"
				aria-label="Dependency matrix"
			>
				<Group left={LABEL_AREA} top={LABEL_AREA}>
					{names.map((name, ci) => (
						<text
							key={`col-${name}`}
							x={ci * CELL_SIZE + CELL_SIZE / 2}
							y={-8}
							textAnchor="start"
							fontSize={LABEL_SIZE}
							fontFamily={chartTheme.font.family}
							fill={chartTheme.colors.textMuted}
							transform={`rotate(-45, ${ci * CELL_SIZE + CELL_SIZE / 2}, -8)`}
						>
							{truncate(name, 14)}
						</text>
					))}

					{names.map((rowName, ri) => (
						<Group key={`row-${rowName}`} top={ri * CELL_SIZE}>
							<text
								x={-8}
								y={CELL_SIZE / 2}
								textAnchor="end"
								dominantBaseline="central"
								fontSize={LABEL_SIZE}
								fontFamily={chartTheme.font.family}
								fill={chartTheme.colors.textMuted}
							>
								{truncate(rowName, 14)}
							</text>

							{names.map((colName, ci) => {
								const count = matrix[ri]?.[ci] ?? 0;
								return (
									<rect
										key={`cell-${rowName}-${colName}`}
										x={ci * CELL_SIZE + 1}
										y={1}
										width={CELL_SIZE - 2}
										height={CELL_SIZE - 2}
										rx={3}
										fill={
											count > 0
												? (colorScale(count) as string)
												: chartTheme.colors.barBg
										}
										stroke={chartTheme.colors.card}
										strokeWidth={1}
										style={{ cursor: count > 0 ? "pointer" : "default" }}
										onMouseMove={(e) => {
											if (count > 0) {
												showTooltip({
													tooltipData: { from: rowName, to: colName, count },
													tooltipLeft: e.clientX,
													tooltipTop: e.clientY,
												});
											}
										}}
										onMouseLeave={hideTooltip}
									/>
								);
							})}
						</Group>
					))}
				</Group>
			</svg>

			{tooltipOpen && tooltipData && (
				<TooltipInPortal
					left={tooltipLeft ?? 0}
					top={tooltipTop ?? 0}
					style={{
						background: chartTheme.colors.text,
						color: "#fff",
						padding: "6px 10px",
						borderRadius: "4px",
						fontSize: "12px",
						fontFamily: chartTheme.font.family,
						pointerEvents: "none",
					}}
				>
					<strong>{tooltipData.from}</strong> →{" "}
					<strong>{tooltipData.to}</strong>
					<br />
					{tooltipData.count} dependencies
				</TooltipInPortal>
			)}
		</div>
	);
}
