import { Group } from "@visx/group";
import { Pie } from "@visx/shape";
import { useTooltip, useTooltipInPortal } from "@visx/tooltip";
import { useEffect, useId, useMemo, useState } from "react";
import ChartCard from "../charts/ChartCard";
import { chartTheme } from "../charts/theme";
import type {
	BalancedCouplingModel,
	BalancedCouplingSnapshot,
} from "./BalancedCouplingTypes";

interface BigBallOfMudChartProps {
	model: BalancedCouplingModel;
	helpText?: string;
	alertTest?: boolean;
}

const RISK_COLORS: Record<BalancedCouplingSnapshot["riskTier"], string> = {
	Low: chartTheme.colors.green,
	Medium: chartTheme.colors.yellow,
	High: chartTheme.colors.orange,
	Critical: chartTheme.colors.red,
};

function hasAlertTestQuery(): boolean {
	if (typeof window === "undefined") return false;

	const params = new URLSearchParams(window.location.search);
	return params.has("alert-test") || params.has("-alert-test");
}

export default function BigBallOfMudChart({
	model,
	helpText,
	alertTest = false,
}: BigBallOfMudChartProps) {
	const [resolvedAlertTest, setResolvedAlertTest] = useState(alertTest);

	useEffect(() => {
		if (alertTest) {
			setResolvedAlertTest(true);
			return;
		}

		if (hasAlertTestQuery()) {
			setResolvedAlertTest(true);
		}
	}, [alertTest]);

	if (model.snapshots.length === 0) return null;

	const chartCardProps = helpText ? { height: 470, helpText } : { height: 470 };
	return (
		<ChartCard {...chartCardProps}>
			{(width, height) => (
				<BigBallOfMudInner
					model={model}
					width={width}
					height={height}
					alertTest={resolvedAlertTest}
				/>
			)}
		</ChartCard>
	);
}

function BigBallOfMudInner({
	model,
	width,
	height,
	alertTest,
}: {
	model: BalancedCouplingModel;
	width: number;
	height: number;
	alertTest: boolean;
}) {
	const [selectedId, setSelectedId] = useState(
		model.aggregate.topRiskComponent ?? model.snapshots[0]?.id ?? "",
	);
	const [alertsEnabled, setAlertsEnabled] = useState(
		alertTest || model.aggregate.overloadedComponents > 0,
	);
	const gradientId = useId();
	const topSnapshots = useMemo(
		() => model.snapshots.slice(0, 14),
		[model.snapshots],
	);
	const selected =
		model.snapshots.find((snapshot) => snapshot.id === selectedId) ??
		model.snapshots[0];
	const {
		tooltipOpen,
		tooltipLeft,
		tooltipTop,
		tooltipData,
		showTooltip,
		hideTooltip,
	} = useTooltip<BalancedCouplingSnapshot>();
	const { containerRef, TooltipInPortal } = useTooltipInPortal({
		detectBounds: true,
		scroll: true,
	});
	const criticalCount = model.snapshots.filter(
		(snapshot) => snapshot.riskTier === "Critical",
	).length;
	const simulatedAlertMode = alertTest && criticalCount === 0;
	const alertPulseIds = useMemo(() => {
		if (simulatedAlertMode) {
			return new Set(
				topSnapshots
					.slice(0, Math.min(3, topSnapshots.length))
					.map((snapshot) => snapshot.id),
			);
		}

		return new Set(
			model.snapshots
				.filter((snapshot) => snapshot.riskTier === "Critical")
				.map((snapshot) => snapshot.id),
		);
	}, [model.snapshots, simulatedAlertMode, topSnapshots]);
	const alertsAvailable = alertTest || alertPulseIds.size > 0;

	useEffect(() => {
		if (alertTest) {
			setAlertsEnabled(true);
		}
	}, [alertTest]);

	useEffect(() => {
		if (
			typeof window === "undefined" ||
			typeof window.matchMedia !== "function"
		)
			return;

		const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
		const syncAlerts = () => {
			if (mediaQuery.matches && !alertTest) {
				setAlertsEnabled(false);
			}
		};

		syncAlerts();
		mediaQuery.addEventListener("change", syncAlerts);
		return () => mediaQuery.removeEventListener("change", syncAlerts);
	}, [alertTest]);

	const detailHeight = 116;
	const chartHeight = Math.max(height - detailHeight, 250);
	const centerX = width / 2;
	const centerY = chartHeight / 2;
	const maxRadius = Math.max(Math.min(width, chartHeight) / 2 - 30, 80);
	const mudRadius = Math.min(
		maxRadius * 0.56,
		Math.max(54, model.aggregate.averageLoad * 8),
	);
	const ringInnerRadius = mudRadius + 16;
	const ringOuterRadius = Math.min(maxRadius * 0.88, ringInnerRadius + 26);
	const orbitRadius = Math.min(maxRadius - 18, ringOuterRadius + 34);
	const alertRingRadius = Math.min(
		maxRadius,
		mudRadius + model.aggregate.maxRisk * 3,
	);
	const alertStrokeColor = alertTest
		? chartTheme.colors.red
		: selected
			? RISK_COLORS[selected.riskTier]
			: chartTheme.colors.accent;
	const mudFill = simulatedAlertMode
		? "var(--color-danger-soft)"
		: `url(#${gradientId}-mud)`;
	const mudStroke = simulatedAlertMode
		? chartTheme.colors.red
		: chartTheme.colors.border;
	const mudStrokeWidth = simulatedAlertMode ? 2.6 : 2;

	return (
		<div ref={containerRef} style={{ position: "relative" }}>
			<svg
				width={width}
				height={height}
				role="img"
				aria-label="Balanced coupling big ball of mud chart"
			>
				<defs>
					<radialGradient id={`${gradientId}-mud`}>
						<stop
							offset="0%"
							stopColor={
								selected
									? RISK_COLORS[selected.riskTier]
									: chartTheme.colors.accent
							}
							stopOpacity="0.35"
						/>
						<stop
							offset="60%"
							stopColor={chartTheme.colors.bg}
							stopOpacity="0.15"
						/>
						<stop
							offset="100%"
							stopColor={chartTheme.colors.bg}
							stopOpacity="0.05"
						/>
					</radialGradient>
				</defs>

				<Group left={centerX} top={centerY}>
					<circle
						cx={0}
						cy={0}
						r={ringOuterRadius + 10}
						fill={chartTheme.colors.card}
						opacity={0.75}
					/>

					<Pie
						data={model.aggregate.dimensionMix}
						pieValue={(entry) => Math.max(entry.value, 0.1)}
						outerRadius={ringOuterRadius}
						innerRadius={ringInnerRadius}
						padAngle={0.03}
					>
						{(pie) =>
							pie.arcs.map((arc) => (
								<path
									key={arc.data.id}
									d={pie.path(arc) ?? undefined}
									fill={arc.data.color}
									fillOpacity={0.42}
									stroke={arc.data.color}
									strokeOpacity={0.75}
								/>
							))
						}
					</Pie>

					<circle
						cx={0}
						cy={0}
						r={mudRadius}
						fill={mudFill}
						stroke={mudStroke}
						strokeWidth={mudStrokeWidth}
					/>
					<circle
						cx={0}
						cy={0}
						r={alertRingRadius}
						fill="none"
						stroke={alertStrokeColor}
						strokeOpacity={simulatedAlertMode ? 0.6 : 0.28}
						strokeWidth={simulatedAlertMode ? 2.4 : 1.5}
					>
						{alertsEnabled && alertsAvailable && (
							<>
								<animate
									attributeName="r"
									values={`${alertRingRadius};${alertRingRadius + (simulatedAlertMode ? 18 : 14)};${alertRingRadius}`}
									dur={simulatedAlertMode ? "1.8s" : "2.8s"}
									repeatCount="indefinite"
								/>
								<animate
									attributeName="stroke-opacity"
									values={
										simulatedAlertMode ? "0.9;0.18;0.9" : "0.52;0.12;0.52"
									}
									dur={simulatedAlertMode ? "1.8s" : "2.8s"}
									repeatCount="indefinite"
								/>
							</>
						)}
					</circle>

					<text
						x={0}
						y={-12}
						textAnchor="middle"
						fill={chartTheme.colors.text}
						fontFamily={chartTheme.font.mono}
						fontSize={13}
						fontWeight={700}
					>
						LOAD {model.aggregate.averageLoad.toFixed(1)}
					</text>
					<text
						x={0}
						y={8}
						textAnchor="middle"
						fill={chartTheme.colors.green}
						fontFamily={chartTheme.font.mono}
						fontSize={11}
						fontWeight={700}
					>
						BAL {model.aggregate.averageBalance.toFixed(1)}
					</text>
					<text
						x={0}
						y={26}
						textAnchor="middle"
						fill={
							selected ? RISK_COLORS[selected.riskTier] : chartTheme.colors.red
						}
						fontFamily={chartTheme.font.mono}
						fontSize={11}
						fontWeight={700}
					>
						{simulatedAlertMode
							? "SIM ALERT"
							: `RISK ${model.aggregate.averageRisk.toFixed(1)}`}
					</text>

					{topSnapshots.map((snapshot, index) => {
						const angle =
							(index / topSnapshots.length) * Math.PI * 2 - Math.PI / 2;
						const nodeX = Math.cos(angle) * orbitRadius;
						const nodeY = Math.sin(angle) * orbitRadius;
						const nodeRadius = 7 + snapshot.systemicRisk * 1.05;
						const selectedNode = snapshot.id === selected?.id;
						const showLabel = selectedNode || index < 8;
						const labelX =
							nodeX + (nodeX >= 0 ? nodeRadius + 8 : -(nodeRadius + 8));
						const pulseNode = alertsEnabled && alertPulseIds.has(snapshot.id);
						const pulseColor = simulatedAlertMode
							? chartTheme.colors.red
							: RISK_COLORS[snapshot.riskTier];

						return (
							<Group key={snapshot.id}>
								{pulseNode && (
									<circle
										cx={nodeX}
										cy={nodeY}
										r={nodeRadius + 6}
										fill="none"
										stroke={pulseColor}
										strokeOpacity={0.46}
										strokeWidth={2}
									>
										<animate
											attributeName="r"
											values={`${nodeRadius + 5};${nodeRadius + (simulatedAlertMode ? 18 : 15)};${nodeRadius + 5}`}
											dur={simulatedAlertMode ? "1.5s" : "2.2s"}
											begin={`${index * 0.14}s`}
											repeatCount="indefinite"
										/>
										<animate
											attributeName="stroke-opacity"
											values={
												simulatedAlertMode ? "0.85;0.05;0.85" : "0.6;0;0.6"
											}
											dur={simulatedAlertMode ? "1.5s" : "2.2s"}
											begin={`${index * 0.14}s`}
											repeatCount="indefinite"
										/>
									</circle>
								)}
								<circle
									cx={nodeX}
									cy={nodeY}
									r={nodeRadius + (selectedNode ? 5 : 2)}
									fill="none"
									stroke={RISK_COLORS[snapshot.riskTier]}
									strokeOpacity={selectedNode ? 0.95 : 0.45}
									strokeWidth={selectedNode ? 2 : 1}
								/>
								<circle
									role="button"
									tabIndex={0}
									cx={nodeX}
									cy={nodeY}
									r={nodeRadius}
									fill={RISK_COLORS[snapshot.riskTier]}
									fillOpacity={0.88}
									stroke={chartTheme.colors.bg}
									strokeWidth={1.5}
									style={{ cursor: "pointer" }}
									onMouseMove={(event) =>
										showTooltip({
											tooltipData: snapshot,
											tooltipLeft: event.clientX,
											tooltipTop: event.clientY,
										})
									}
									onMouseLeave={hideTooltip}
									onFocus={() => setSelectedId(snapshot.id)}
									onBlur={hideTooltip}
									onClick={() => setSelectedId(snapshot.id)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault();
											setSelectedId(snapshot.id);
										}
									}}
								/>
								{showLabel && (
									<text
										x={labelX}
										y={nodeY}
										textAnchor={nodeX >= 0 ? "start" : "end"}
										dominantBaseline="central"
										fill={
											selectedNode
												? chartTheme.colors.text
												: chartTheme.colors.textMuted
										}
										fontFamily={chartTheme.font.family}
										fontSize={11}
										fontWeight={selectedNode ? 700 : 500}
									>
										{truncateLabel(snapshot.component)}
									</text>
								)}
							</Group>
						);
					})}
				</Group>
			</svg>

			<div
				style={{
					display: "grid",
					gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr)",
					gap: "0.9rem",
					alignItems: "start",
					marginTop: "0.35rem",
				}}
			>
				<div style={{ minWidth: 0 }}>
					<div
						style={{
							fontSize: "1rem",
							fontWeight: 700,
							color: chartTheme.colors.text,
							marginBottom: "0.3rem",
						}}
					>
						{selected?.component}
						{simulatedAlertMode && (
							<span
								style={{
									display: "inline-flex",
									alignItems: "center",
									marginLeft: "0.5rem",
									padding: "0.12rem 0.45rem",
									borderRadius: "999px",
									background: "var(--color-danger-soft)",
									color: chartTheme.colors.red,
									fontSize: "0.72rem",
									fontWeight: 800,
									letterSpacing: "0.04em",
									textTransform: "uppercase",
									verticalAlign: "middle",
								}}
							>
								Simulated Alert
							</span>
						)}
					</div>
					<div
						style={{
							fontSize: "0.84rem",
							color: chartTheme.colors.textMuted,
							lineHeight: 1.55,
						}}
					>
						{selected?.explainability.join(" • ")}
					</div>
				</div>

				<div
					style={{
						display: "grid",
						gridTemplateColumns: "1fr",
						gap: "0.55rem",
					}}
				>
					<button
						type="button"
						onClick={() =>
							setAlertsEnabled((current) =>
								alertsAvailable ? !current : current,
							)
						}
						disabled={!alertsAvailable}
						aria-pressed={alertsEnabled}
						style={{
							justifySelf: "start",
							border: `1px solid ${alertsEnabled ? chartTheme.colors.red : chartTheme.colors.border}`,
							background: alertsEnabled
								? "var(--color-danger-soft)"
								: chartTheme.colors.card,
							color: alertsEnabled
								? chartTheme.colors.red
								: chartTheme.colors.textMuted,
							borderRadius: "999px",
							padding: "0.38rem 0.8rem",
							fontSize: "0.75rem",
							fontWeight: 700,
							letterSpacing: "0.04em",
							textTransform: "uppercase",
							cursor: alertsAvailable ? "pointer" : "not-allowed",
							opacity: alertsAvailable ? 1 : 0.55,
						}}
					>
						{alertsAvailable
							? `${alertTest ? "Simulated " : ""}Alert Pulse ${alertsEnabled ? "On" : "Off"}`
							: "No Critical Pulse"}
					</button>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
							gap: "0.55rem",
						}}
					>
						{[
							{
								label: "Static",
								value: selected?.staticCoupling ?? 0,
								color: chartTheme.colors.accent,
							},
							{
								label: "Temporal",
								value: selected?.temporalCoupling ?? 0,
								color: "#8b5cf6",
							},
							{
								label: "Coordination",
								value: selected?.coordinationCoupling ?? 0,
								color: "#06b6d4",
							},
							{
								label: "Knowledge",
								value: selected?.knowledgeRisk ?? 0,
								color: chartTheme.colors.red,
							},
						].map((item) => (
							<div
								key={item.label}
								style={{
									border: `1px solid ${chartTheme.colors.border}`,
									borderRadius: "12px",
									padding: "0.6rem 0.75rem",
									background: chartTheme.colors.card,
								}}
							>
								<div
									style={{
										fontSize: "0.72rem",
										textTransform: "uppercase",
										letterSpacing: "0.06em",
										color: chartTheme.colors.textMuted,
										marginBottom: "0.2rem",
									}}
								>
									{item.label}
								</div>
								<div
									style={{
										fontSize: "1.1rem",
										fontWeight: 700,
										color: item.color,
										fontFamily: chartTheme.font.mono,
									}}
								>
									{item.value.toFixed(1)}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{tooltipOpen && tooltipData && (
				<TooltipInPortal
					left={tooltipLeft ?? 0}
					top={tooltipTop ?? 0}
					style={{
						background: chartTheme.colors.text,
						color: "#fff",
						padding: "8px 12px",
						borderRadius: "8px",
						fontSize: "12px",
						fontFamily: chartTheme.font.family,
						pointerEvents: "none",
						maxWidth: "18rem",
						lineHeight: 1.5,
					}}
				>
					<strong>{tooltipData.component}</strong>
					<br />
					Risk {tooltipData.systemicRisk.toFixed(1)} • {tooltipData.riskTier}
					<br />
					{tooltipData.dominantDimension
						.replace("Coupling", "")
						.replace("knowledgeRisk", "knowledge")}{" "}
					pressure
					<br />
					{tooltipData.files} files • {tooltipData.loc.toLocaleString()} LOC
				</TooltipInPortal>
			)}
		</div>
	);
}

function truncateLabel(label: string): string {
	return label.length > 18 ? `${label.slice(0, 16)}…` : label;
}
