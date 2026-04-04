import { Group } from "@visx/group";
import { Pie } from "@visx/shape";
import { useTooltip, useTooltipInPortal } from "@visx/tooltip";
import ChartCard from "./ChartCard";
import { chartTheme } from "./theme";

export interface DonutItem {
	readonly label: string;
	readonly value: number;
}

interface DonutChartProps {
	data: ReadonlyArray<DonutItem>;
	valueLabel?: string;
	helpText?: string;
	colors?: ReadonlyArray<string>;
}

const PALETTE = chartTheme.colors.palette;
const DONUT_THICKNESS = 40;
const LEGEND_WIDTH = 160;
const CHART_GAP = 16;
const CHART_PADDING = 16;

export default function DonutChart({
	data,
	valueLabel,
	helpText,
	colors,
}: DonutChartProps) {
	if (data.length === 0) return null;

	const chartCardProps = helpText ? { height: 300, helpText } : { height: 300 };

	return (
		<ChartCard {...chartCardProps}>
			{(width) => (
				<DonutInner
					data={data}
					width={width}
					height={300}
					{...(valueLabel ? { valueLabel } : {})}
					{...(colors ? { colors } : {})}
				/>
			)}
		</ChartCard>
	);
}

function DonutInner({
	data,
	valueLabel,
	colors,
	width,
	height,
}: DonutChartProps & { width: number; height: number }) {
	const {
		tooltipOpen,
		tooltipLeft,
		tooltipTop,
		tooltipData,
		showTooltip,
		hideTooltip,
	} = useTooltip<DonutItem & { percentage: number }>();
	const { containerRef, TooltipInPortal } = useTooltipInPortal({
		detectBounds: true,
		scroll: true,
	});

	const colorScale = colors ?? PALETTE;
	const pieData = [...data];
	const total = pieData.reduce((sum, item) => sum + item.value, 0);
	const availableChartWidth = Math.max(width - LEGEND_WIDTH - CHART_GAP, 0);
	const chartSize = Math.max(
		Math.min(availableChartWidth, height) - CHART_PADDING * 2,
		120,
	);
	const svgWidth = chartSize + CHART_PADDING * 2;
	const radius = chartSize / 2;
	const innerRadius = Math.max(radius - DONUT_THICKNESS, radius * 0.58);
	const centerX = radius + CHART_PADDING;
	const centerY = height / 2;

	return (
		<div
			ref={containerRef}
			style={{
				position: "relative",
				display: "flex",
				alignItems: "center",
				gap: "1rem",
			}}
		>
			<svg width={svgWidth} height={height} role="img" aria-label="Donut chart">
				<Group left={centerX} top={centerY}>
					<Pie
						pieValue={(item: DonutItem) => item.value}
						data={pieData}
						outerRadius={radius}
						innerRadius={innerRadius}
						cornerRadius={3}
						padAngle={0.02}
					>
						{(pie) =>
							pie.arcs.map((arc: (typeof pie.arcs)[number], index: number) => {
								const path = pie.path(arc) ?? "";
								const color = colorScale[index % colorScale.length];
								return (
									<path
										key={arc.data.label}
										d={path}
										fill={color}
										style={{ cursor: "pointer" }}
										onMouseMove={(event) => {
											showTooltip({
												tooltipData: {
													...arc.data,
													percentage:
														total > 0 ? (arc.data.value / total) * 100 : 0,
												},
												tooltipLeft: event.clientX,
												tooltipTop: event.clientY,
											});
										}}
										onMouseLeave={hideTooltip}
									/>
								);
							})
						}
					</Pie>
					<text
						textAnchor="middle"
						dominantBaseline="central"
						fontSize={18}
						fontWeight={700}
						fontFamily={chartTheme.font.family}
						fill={chartTheme.colors.text}
						dy={-6}
					>
						{total.toLocaleString()}
					</text>
					<text
						textAnchor="middle"
						dominantBaseline="central"
						fontSize={10}
						fontFamily={chartTheme.font.family}
						fill={chartTheme.colors.textMuted}
						dy={12}
					>
						{valueLabel ?? "total"}
					</text>
				</Group>
			</svg>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					gap: "4px",
					minWidth: LEGEND_WIDTH,
				}}
			>
				{pieData.slice(0, 10).map((item, index) => {
					const percentage =
						total > 0 ? ((item.value / total) * 100).toFixed(1) : "0";
					return (
						<div
							key={item.label}
							style={{
								display: "flex",
								alignItems: "center",
								gap: "6px",
								fontSize: "11px",
								fontFamily: chartTheme.font.family,
							}}
						>
							<div
								style={{
									width: 10,
									height: 10,
									borderRadius: 2,
									background: colorScale[index % colorScale.length],
									flexShrink: 0,
								}}
							/>
							<span
								style={{
									color: chartTheme.colors.text,
									overflow: "hidden",
									textOverflow: "ellipsis",
									whiteSpace: "nowrap",
									flex: 1,
								}}
							>
								{item.label}
							</span>
							<span
								style={{
									color: chartTheme.colors.textMuted,
									fontFamily: chartTheme.font.mono,
									fontSize: "10px",
								}}
							>
								{percentage}%
							</span>
						</div>
					);
				})}
				{pieData.length > 10 ? (
					<div
						style={{
							fontSize: "10px",
							color: chartTheme.colors.textMuted,
							fontStyle: "italic",
						}}
					>
						+{pieData.length - 10} more
					</div>
				) : null}
			</div>

			{tooltipOpen && tooltipData ? (
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
					<strong>{tooltipData.label}</strong>
					<br />
					{tooltipData.value.toLocaleString()} {valueLabel ?? ""}
					<br />
					{tooltipData.percentage.toFixed(1)}%
				</TooltipInPortal>
			) : null}
		</div>
	);
}
