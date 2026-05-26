import { HeatmapRect } from "@visx/heatmap";
import { useTooltip, useTooltipInPortal } from "@visx/tooltip";
import type {
	ContributorHeatmapCell,
	DailyActivityEntry,
} from "../contributors/contributorHeatmap.js";
import { buildContributorHeatmap } from "../contributors/contributorHeatmap.js";
import ChartCard from "./ChartCard.js";
import { chartTheme } from "./theme.js";

interface CommitHeatmapProps {
	data: DailyActivityEntry[];
	endDate?: string;
	weeks?: number;
	height?: number;
	helpText?: string;
}

const DAY_LABEL_WIDTH = 40;
const TOP_LABEL_HEIGHT = 4;
const CHART_PADDING_RIGHT = 8;
const MONTH_AXIS_MARGIN_TOP = 8;
const FOOTER_MARGIN_TOP = 12;
const CELL_GAP = 4;
const MIN_CELL_SIZE = 9;
const MAX_CELL_SIZE = 14;
const CELL_COLORS = [
	"#dbeafe",
	"#bfdbfe",
	"#93c5fd",
	"#58A6FF",
	"#2B7FD4",
	"#1656A8",
];
const VISIBLE_WEEKDAY_INDICES = new Set([0, 2, 4]);

export default function CommitHeatmap({
	data,
	endDate,
	weeks = 53,
	height = 250,
	helpText,
}: CommitHeatmapProps) {
	if (data.length === 0) return null;

	const heatmap = buildContributorHeatmap(data, {
		...(endDate !== undefined ? { endDate } : {}),
		weeks,
	});

	return (
		<ChartCard height={height} {...(helpText !== undefined ? { helpText } : {})}>
			{(width) => (
				<CommitHeatmapInner width={width} height={height} heatmap={heatmap} />
			)}
		</ChartCard>
	);
}

function CommitHeatmapInner({
	width,
	height,
	heatmap,
}: {
	width: number;
	height: number;
	heatmap: ReturnType<typeof buildContributorHeatmap>;
}) {
	const {
		tooltipOpen,
		tooltipLeft,
		tooltipTop,
		tooltipData,
		showTooltip,
		hideTooltip,
	} = useTooltip<ContributorHeatmapCell>();
	const { containerRef, TooltipInPortal } = useTooltipInPortal({
		detectBounds: true,
		scroll: true,
	});

	const rightPaneWidth = Math.max(width - DAY_LABEL_WIDTH, 0);
	const availableWidth = Math.max(rightPaneWidth - CHART_PADDING_RIGHT, 0);
	const availableHeight = height - TOP_LABEL_HEIGHT - 4;
	const columnCount = heatmap.weeks.length;
	const rowCount = heatmap.weekdayLabels.length;
	const maxCellWidth =
		(availableWidth - CELL_GAP * (columnCount - 1)) / columnCount;
	const maxCellHeight =
		(availableHeight - CELL_GAP * (rowCount - 1)) / rowCount;
	const cellSize = Math.max(
		MIN_CELL_SIZE,
		Math.min(MAX_CELL_SIZE, maxCellWidth, maxCellHeight),
	);
	const cellStep = cellSize + CELL_GAP;
	const chartWidth = cellSize * columnCount + CELL_GAP * (columnCount - 1);
	const chartLeft = Math.max((availableWidth - chartWidth) / 2, 0);
	const chartTop = TOP_LABEL_HEIGHT;
	const svgHeight = chartTop + cellSize * rowCount + CELL_GAP * (rowCount - 1);

	return (
		<div ref={containerRef} style={{ position: "relative" }}>
			<div style={{ display: "flex", alignItems: "flex-start" }}>
				<div
					style={{
						width: `${DAY_LABEL_WIDTH}px`,
						height: `${svgHeight}px`,
						position: "relative",
						flexShrink: 0,
					}}
				>
					{heatmap.weekdayLabels.map((label, index) =>
						VISIBLE_WEEKDAY_INDICES.has(index) ? (
							<span
								key={label}
								style={{
									position: "absolute",
									right: "6px",
									top: `${chartTop + index * cellStep + cellSize / 2}px`,
									transform: "translateY(-50%)",
									color: chartTheme.colors.textMuted,
									fontSize: `${chartTheme.font.tickSize}px`,
									fontFamily: chartTheme.font.family,
									lineHeight: 1,
									whiteSpace: "nowrap",
									pointerEvents: "none",
								}}
							>
								{label}
							</span>
						) : null,
					)}
				</div>

				<div style={{ width: `${rightPaneWidth}px`, minWidth: 0 }}>
					<svg
						width={rightPaneWidth}
						height={svgHeight}
						role="img"
						aria-label="Contributor commit heatmap"
					>
						<HeatmapRect
							data={heatmap.weeks}
							left={chartLeft}
							top={chartTop}
							xScale={(weekIndex) => weekIndex * cellStep}
							yScale={(dayIndex) => dayIndex * cellStep}
							binWidth={cellStep}
							binHeight={cellStep}
							gap={CELL_GAP}
							bins={(week) => week.bins}
							count={(bin) => bin.commits}
						>
							{(cells) =>
								cells.map((column) =>
									column.map((cell) => {
										const commitCount = cell.count ?? 0;
										return (
											<rect
												key={cell.bin.date}
												x={cell.x}
												y={cell.y}
												width={cell.width}
												height={cell.height}
												rx={0}
												fill={getCellColor(commitCount, heatmap.maxCommits)}
												stroke={
													commitCount > 0
														? "rgba(255,255,255,0.32)"
														: chartTheme.colors.border
												}
												strokeWidth={1}
												tabIndex={0}
												aria-label={`${cell.bin.date}: ${cell.bin.commits} ${cell.bin.commits === 1 ? "commit" : "commits"}`}
												style={{ cursor: "pointer", outline: "none" }}
												onMouseEnter={(event) =>
													showTooltip({
														tooltipLeft: event.clientX,
														tooltipTop: event.clientY,
														tooltipData: cell.bin,
													})
												}
												onMouseMove={(event) =>
													showTooltip({
														tooltipLeft: event.clientX,
														tooltipTop: event.clientY,
														tooltipData: cell.bin,
													})
												}
												onMouseLeave={hideTooltip}
												onFocus={(event) =>
													showTooltip({
														tooltipLeft:
															event.currentTarget.getBoundingClientRect().left +
															event.currentTarget.getBoundingClientRect().width / 2,
														tooltipTop:
															event.currentTarget.getBoundingClientRect().top,
														tooltipData: cell.bin,
													})
												}
												onBlur={hideTooltip}
											>
												<title>
													{cell.bin.date}: {cell.bin.commits}{" "}
													{cell.bin.commits === 1 ? "commit" : "commits"}
												</title>
											</rect>
										);
									}),
								)
							}
						</HeatmapRect>
					</svg>

					<div
						style={{
							marginTop: `${MONTH_AXIS_MARGIN_TOP}px`,
							marginLeft: `${chartLeft}px`,
							width: `${chartWidth}px`,
							height: "16px",
							position: "relative",
						}}
					>
						{heatmap.monthLabels.map((label) => (
							<span
								key={`${label.weekIndex}-${label.label}`}
								style={{
									position: "absolute",
									left: `${Math.min(label.weekIndex * cellStep, Math.max(chartWidth - 24, 0))}px`,
									top: 0,
									color: chartTheme.colors.textMuted,
									fontSize: `${chartTheme.font.tickSize}px`,
									fontFamily: chartTheme.font.family,
									lineHeight: 1,
									whiteSpace: "nowrap",
									pointerEvents: "none",
								}}
							>
								{label.label}
							</span>
						))}
					</div>
				</div>
			</div>

			<div
				style={{
					marginTop: `${FOOTER_MARGIN_TOP}px`,
					display: "flex",
					justifyContent: "space-between",
					alignItems: "center",
					gap: "0.75rem",
					flexWrap: "wrap",
				}}
			>
				<span
					style={{
						color: chartTheme.colors.textMuted,
						fontSize: "0.75rem",
						fontFamily: chartTheme.font.family,
					}}
				>
					{heatmap.activeDays.toLocaleString()} active days from {heatmap.startDate} to{" "}
					{heatmap.endDate}
				</span>

				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.35rem",
						color: chartTheme.colors.textMuted,
						fontSize: "0.72rem",
					}}
				>
					<span>Less</span>
					{getLegendColors(heatmap.maxCommits).map((color) => (
						<span
							key={color}
							style={{
								width: 12,
								height: 12,
								borderRadius: "var(--radius-inline)",
								background: color,
								border: `1px solid ${chartTheme.colors.border}`,
								display: "inline-block",
							}}
						/>
					))}
					<span>More</span>
				</div>
			</div>

			{tooltipOpen && tooltipData && (
				<TooltipInPortal
					{...(tooltipLeft !== undefined ? { left: tooltipLeft } : {})}
					{...(tooltipTop !== undefined ? { top: tooltipTop } : {})}
					style={{
						background: chartTheme.colors.text,
						color: "#fff",
						padding: "6px 10px",
						borderRadius: "var(--radius-overlay)",
						fontSize: "12px",
						fontFamily: chartTheme.font.family,
						pointerEvents: "none",
						zIndex: 10,
					}}
				>
					<strong>{tooltipData.date}</strong>
					<br />
					{tooltipData.commits.toLocaleString()}{" "}
					{tooltipData.commits === 1 ? "commit" : "commits"}
				</TooltipInPortal>
			)}
		</div>
	);
}

function getCellColor(count: number, maxCommits: number): string {
	if (count <= 0 || maxCommits <= 0) return chartTheme.colors.barBg;
	const level = Math.min(
		CELL_COLORS.length - 1,
		Math.ceil((count / maxCommits) * (CELL_COLORS.length - 1)),
	);
	return CELL_COLORS[level] ?? CELL_COLORS[CELL_COLORS.length - 1] ?? chartTheme.colors.barBg;
}

function getLegendColors(maxCommits: number): string[] {
	if (maxCommits <= 0) return [chartTheme.colors.barBg];
	const last = CELL_COLORS[CELL_COLORS.length - 1] ?? chartTheme.colors.barBg;
	return [chartTheme.colors.barBg, ...CELL_COLORS.slice(0, 4), last];
}
