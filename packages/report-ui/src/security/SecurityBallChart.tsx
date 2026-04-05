import { Group } from "@visx/group"
import { Pie } from "@visx/shape"
import { useTooltip, useTooltipInPortal } from "@visx/tooltip"
import { useEffect, useId, useMemo, useState } from "react"
import ChartCard from "../charts/ChartCard.js"
import { chartTheme } from "../charts/theme.js"

interface RepoSecurityNode {
	repo: string
	href?: string
	totalAlerts: number
	openAlerts: number
	critical: number
	high: number
	medium: number
	low: number
	mttrDays: number | null
	oldestOpenDays: number | null
}

interface SecurityBallChartProps {
	repos: RepoSecurityNode[]
	totalOpen: number
	severityCounts: {
		critical: number
		high: number
		medium: number
		low: number
	}
	exposureScore: number
	helpText?: string
}

const SEVERITY_COLORS = {
	critical: chartTheme.colors.red,
	high: chartTheme.colors.orange,
	medium: chartTheme.colors.yellow,
	low: chartTheme.colors.green,
} as const

function getSeverityTier(repo: RepoSecurityNode): keyof typeof SEVERITY_COLORS {
	if (repo.critical > 0) return "critical"
	if (repo.high > 0) return "high"
	if (repo.medium > 0) return "medium"
	return "low"
}

function truncateLabel(label: string): string {
	return label.length > 18 ? `${label.slice(0, 16)}…` : label
}

export default function SecurityBallChart({
	repos,
	totalOpen,
	severityCounts,
	exposureScore,
	helpText,
}: SecurityBallChartProps) {
	const reposWithAlerts = repos.filter((r) => r.totalAlerts > 0)
	if (reposWithAlerts.length === 0) return null

	return (
		<ChartCard height={500} {...(helpText !== undefined ? { helpText } : {})}>
			{(width, height) => (
				<SecurityBallInner
					repos={reposWithAlerts}
					totalOpen={totalOpen}
					severityCounts={severityCounts}
					exposureScore={exposureScore}
					width={width}
					height={height}
				/>
			)}
		</ChartCard>
	)
}

function SecurityBallInner({
	repos,
	totalOpen,
	severityCounts,
	exposureScore,
	width,
	height,
}: {
	repos: RepoSecurityNode[]
	totalOpen: number
	severityCounts: { critical: number; high: number; medium: number; low: number }
	exposureScore: number
	width: number
	height: number
}) {
	const [selectedRepo, setSelectedRepo] = useState<string>(repos[0]?.repo ?? "")
	const [alertsEnabled, setAlertsEnabled] = useState(severityCounts.critical > 0)
	const gradientId = useId()
	const topRepos = useMemo(
		() => repos.slice().sort((a, b) => b.openAlerts - a.openAlerts).slice(0, 14),
		[repos],
	)
	const selected = repos.find((r) => r.repo === selectedRepo) ?? repos[0]
	const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } =
		useTooltip<RepoSecurityNode>()
	const { containerRef, TooltipInPortal } = useTooltipInPortal({
		detectBounds: true,
		scroll: true,
	})

	const criticalRepos = repos.filter((r) => r.critical > 0)
	const alertPulseIds = useMemo(() => new Set(criticalRepos.map((r) => r.repo)), [criticalRepos])

	useEffect(() => {
		if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
		const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
		const sync = () => {
			if (mq.matches) setAlertsEnabled(false)
		}
		sync()
		mq.addEventListener("change", sync)
		return () => mq.removeEventListener("change", sync)
	}, [])

	const detailHeight = 130
	const chartHeight = Math.max(height - detailHeight, 260)
	const centerX = width / 2
	const centerY = chartHeight / 2
	const maxRadius = Math.max(Math.min(width, chartHeight) / 2 - 30, 80)
	const mudRadius = Math.min(maxRadius * 0.5, Math.max(50, exposureScore * 72))
	const ringInnerRadius = mudRadius + 14
	const ringOuterRadius = Math.min(maxRadius * 0.82, ringInnerRadius + 28)
	const orbitRadius = Math.min(maxRadius - 18, ringOuterRadius + 34)
	const alertRingRadius = Math.min(maxRadius, mudRadius + Math.min(exposureScore * 40, 30))

	const severityPie = [
		{ id: "critical", value: severityCounts.critical, color: chartTheme.colors.red },
		{ id: "high", value: severityCounts.high, color: chartTheme.colors.orange },
		{ id: "medium", value: severityCounts.medium, color: chartTheme.colors.yellow },
		{ id: "low", value: severityCounts.low, color: chartTheme.colors.green },
	].filter((d) => d.value > 0)

	const selectedTier = selected ? getSeverityTier(selected) : "low"
	const alertStrokeColor = SEVERITY_COLORS[selectedTier]

	return (
		<div ref={containerRef} style={{ position: "relative" }}>
			<svg
				width={width}
				height={height}
				role="img"
				aria-label="Security vulnerability landscape chart showing repository alert distribution"
			>
				<defs>
					<radialGradient id={`${gradientId}-vul`}>
						<stop offset="0%" stopColor={alertStrokeColor} stopOpacity="0.40" />
						<stop offset="55%" stopColor={chartTheme.colors.bg} stopOpacity="0.15" />
						<stop offset="100%" stopColor={chartTheme.colors.bg} stopOpacity="0.05" />
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
						data={severityPie}
						pieValue={(d) => Math.max(d.value, 0.1)}
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
									fillOpacity={0.5}
									stroke={arc.data.color}
									strokeOpacity={0.8}
								/>
							))
						}
					</Pie>

					<circle
						cx={0}
						cy={0}
						r={mudRadius}
						fill={`url(#${gradientId}-vul)`}
						stroke={chartTheme.colors.border}
						strokeWidth={2}
					/>

					<circle
						cx={0}
						cy={0}
						r={alertRingRadius}
						fill="none"
						stroke={alertStrokeColor}
						strokeOpacity={0.28}
						strokeWidth={1.5}
					>
						{alertsEnabled && alertPulseIds.size > 0 && (
							<>
								<animate
									attributeName="r"
									values={`${alertRingRadius};${alertRingRadius + 14};${alertRingRadius}`}
									dur="2.8s"
									repeatCount="indefinite"
								/>
								<animate
									attributeName="stroke-opacity"
									values="0.52;0.08;0.52"
									dur="2.8s"
									repeatCount="indefinite"
								/>
							</>
						)}
					</circle>

					<text
						x={0}
						y={-14}
						textAnchor="middle"
						fill={chartTheme.colors.text}
						fontFamily={chartTheme.font.mono}
						fontSize={13}
						fontWeight={700}
					>
						{totalOpen.toLocaleString()} OPEN
					</text>
					<text
						x={0}
						y={6}
						textAnchor="middle"
						fill={chartTheme.colors.red}
						fontFamily={chartTheme.font.mono}
						fontSize={11}
						fontWeight={700}
					>
						{severityCounts.critical} CRITICAL
					</text>
					<text
						x={0}
						y={24}
						textAnchor="middle"
						fill={chartTheme.colors.textMuted}
						fontFamily={chartTheme.font.mono}
						fontSize={10}
						fontWeight={600}
					>
						{Math.round(exposureScore * 100)}% EXPOSURE
					</text>

					{topRepos.map((repo, index) => {
						const angle = (index / topRepos.length) * Math.PI * 2 - Math.PI / 2
						const nodeX = Math.cos(angle) * orbitRadius
						const nodeY = Math.sin(angle) * orbitRadius
						const tier = getSeverityTier(repo)
						const nodeRadius = 6 + Math.min(repo.openAlerts * 0.08, 10)
						const isSelected = repo.repo === selected?.repo
						const showLabel = isSelected || index < 8
						const labelX = nodeX + (nodeX >= 0 ? nodeRadius + 8 : -(nodeRadius + 8))
						const pulseNode = alertsEnabled && alertPulseIds.has(repo.repo)

						return (
							<Group key={repo.repo}>
								{pulseNode && (
									<circle
										cx={nodeX}
										cy={nodeY}
										r={nodeRadius + 6}
										fill="none"
										stroke={chartTheme.colors.red}
										strokeOpacity={0.46}
										strokeWidth={2}
									>
										<animate
											attributeName="r"
											values={`${nodeRadius + 5};${nodeRadius + 15};${nodeRadius + 5}`}
											dur="2.2s"
											begin={`${index * 0.14}s`}
											repeatCount="indefinite"
										/>
										<animate
											attributeName="stroke-opacity"
											values="0.6;0;0.6"
											dur="2.2s"
											begin={`${index * 0.14}s`}
											repeatCount="indefinite"
										/>
									</circle>
								)}
								<circle
									cx={nodeX}
									cy={nodeY}
									r={nodeRadius + (isSelected ? 5 : 2)}
									fill="none"
									stroke={SEVERITY_COLORS[tier]}
									strokeOpacity={isSelected ? 0.95 : 0.45}
									strokeWidth={isSelected ? 2 : 1}
								/>
								{/* biome-ignore lint/a11y/useSemanticElements: SVG circles cannot be replaced with <button> */}
								<g
									role="button"
									tabIndex={0}
									aria-label={`Select ${repo.repo}`}
									style={{ cursor: "pointer" }}
									onMouseMove={(event) =>
										showTooltip({
											tooltipData: repo,
											tooltipLeft: event.clientX,
											tooltipTop: event.clientY,
										})
									}
									onMouseLeave={hideTooltip}
									onFocus={() => setSelectedRepo(repo.repo)}
									onBlur={hideTooltip}
									onClick={() => setSelectedRepo(repo.repo)}
									onKeyDown={(event) => {
										if (event.key === "Enter" || event.key === " ") {
											event.preventDefault()
											setSelectedRepo(repo.repo)
										}
									}}
								>
									<circle
										cx={nodeX}
										cy={nodeY}
										r={nodeRadius}
										fill={SEVERITY_COLORS[tier]}
										fillOpacity={0.88}
										stroke={chartTheme.colors.bg}
										strokeWidth={1.5}
									/>
								</g>
								{showLabel &&
									(repo.href ? (
										<a href={repo.href} style={{ textDecoration: "none" }}>
											<text
												x={labelX}
												y={nodeY}
												textAnchor={nodeX >= 0 ? "start" : "end"}
												dominantBaseline="central"
												fill={isSelected ? chartTheme.colors.text : chartTheme.colors.textMuted}
												fontFamily={chartTheme.font.family}
												fontSize={11}
												fontWeight={isSelected ? 700 : 500}
												style={{ cursor: "pointer" }}
											>
												{truncateLabel(repo.repo)}
											</text>
										</a>
									) : (
										<text
											x={labelX}
											y={nodeY}
											textAnchor={nodeX >= 0 ? "start" : "end"}
											dominantBaseline="central"
											fill={isSelected ? chartTheme.colors.text : chartTheme.colors.textMuted}
											fontFamily={chartTheme.font.family}
											fontSize={11}
											fontWeight={isSelected ? 700 : 500}
										>
											{truncateLabel(repo.repo)}
										</text>
									))}
							</Group>
						)
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
						{selected?.href ? (
							<a
								href={selected.href}
								style={{
									color: "inherit",
									textDecoration: "none",
									borderBottom: `1px solid ${chartTheme.colors.border}`,
								}}
							>
								{selected.repo} ↗
							</a>
						) : (
							selected?.repo
						)}
					</div>
					<div
						style={{
							fontSize: "0.84rem",
							color: chartTheme.colors.textMuted,
							lineHeight: 1.55,
						}}
					>
						{selected ? `${selected.openAlerts} open of ${selected.totalAlerts} total alerts` : ""}
						{selected?.mttrDays !== null && selected?.mttrDays !== undefined
							? ` • MTTR ${selected.mttrDays}d`
							: ""}
						{selected?.oldestOpenDays !== null && selected?.oldestOpenDays !== undefined
							? ` • Oldest open ${selected.oldestOpenDays}d`
							: ""}
					</div>
				</div>

				<div style={{ display: "grid", gap: "0.55rem" }}>
					<button
						type="button"
						onClick={() => setAlertsEnabled((c) => (alertPulseIds.size > 0 ? !c : c))}
						disabled={alertPulseIds.size === 0}
						aria-pressed={alertsEnabled}
						style={{
							justifySelf: "start",
							border: `1px solid ${alertsEnabled ? chartTheme.colors.red : chartTheme.colors.border}`,
							background: alertsEnabled ? "var(--color-danger-soft)" : chartTheme.colors.card,
							color: alertsEnabled ? chartTheme.colors.red : chartTheme.colors.textMuted,
							borderRadius: "999px",
							padding: "0.38rem 0.8rem",
							fontSize: "0.75rem",
							fontWeight: 700,
							letterSpacing: "0.04em",
							textTransform: "uppercase",
							cursor: alertPulseIds.size > 0 ? "pointer" : "not-allowed",
							opacity: alertPulseIds.size > 0 ? 1 : 0.55,
						}}
					>
						{alertPulseIds.size > 0
							? `Critical Pulse ${alertsEnabled ? "On" : "Off"}`
							: "No Critical Alerts"}
					</button>

					<div
						style={{
							display: "grid",
							gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
							gap: "0.55rem",
						}}
					>
						{(
							[
								{ label: "Critical", value: selected?.critical ?? 0, color: chartTheme.colors.red },
								{ label: "High", value: selected?.high ?? 0, color: chartTheme.colors.orange },
								{ label: "Medium", value: selected?.medium ?? 0, color: chartTheme.colors.yellow },
								{ label: "Low", value: selected?.low ?? 0, color: chartTheme.colors.green },
							] as const
						).map((item) => (
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
									{item.value}
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{tooltipOpen && tooltipData && (
				<TooltipInPortal
					{...(tooltipLeft !== undefined ? { left: tooltipLeft } : {})}
					{...(tooltipTop !== undefined ? { top: tooltipTop } : {})}
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
					<strong>{tooltipData.repo}</strong>
					<br />
					{tooltipData.openAlerts} open / {tooltipData.totalAlerts} total
					<br />
					Critical {tooltipData.critical} • High {tooltipData.high} • Med {tooltipData.medium} • Low{" "}
					{tooltipData.low}
					{tooltipData.mttrDays !== null && (
						<>
							<br />
							MTTR: {tooltipData.mttrDays} days
						</>
					)}
				</TooltipInPortal>
			)}
		</div>
	)
}
