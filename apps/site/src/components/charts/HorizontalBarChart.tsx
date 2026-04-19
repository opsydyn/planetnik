import { Group } from "@visx/group"
import { scaleLinear } from "@visx/scale"
import { useTooltip, useTooltipInPortal } from "@visx/tooltip"
import type { TechnologyIconData } from "../../lib/iconography"
import ChartCard from "./ChartCard"
import { chartTheme } from "./theme"

interface BarItem {
  label: string
  value: number
  icon?: TechnologyIconData | null
  href?: string
}

interface HorizontalBarChartProps {
  data: ReadonlyArray<BarItem>
  valueLabel?: string
  maxItems?: number
  barColor?: string
  helpText?: string
}

const LABEL_WIDTH = 140
const LABEL_WIDTH_WITH_ICON = 168
const VALUE_WIDTH = 70
const ROW_HEIGHT = 28
const BAR_HEIGHT = 18
const BAR_Y = (ROW_HEIGHT - BAR_HEIGHT) / 2
const ICON_SIZE = 18
const ICON_GAP = 8
const LABEL_RIGHT_PADDING = 8

function getDisplayLabel(label: string): string {
  return label.length > 20 ? `${label.slice(0, 18)}…` : label
}

function estimateLabelWidth(label: string): number {
  return Math.ceil(label.length * chartTheme.font.labelSize * 0.62)
}

export default function HorizontalBarChart({
  data,
  valueLabel,
  maxItems = 15,
  barColor,
  helpText,
}: HorizontalBarChartProps) {
  const items = data.slice(0, maxItems)
  const height = items.length * ROW_HEIGHT
  const labelWidth = items.some((item) => item.icon) ? LABEL_WIDTH_WITH_ICON : LABEL_WIDTH

  return (
    <ChartCard height={height} helpText={helpText}>
      {(width) => {
        const barAreaWidth = Math.max(width - labelWidth - VALUE_WIDTH - 16, 40)
        const maxValue = Math.max(...items.map((d) => d.value), 1)
        const xScale = scaleLinear({
          domain: [0, maxValue],
          range: [0, barAreaWidth],
        })

        return (
          <HorizontalBarInner
            items={items}
            barColor={barColor}
            width={width}
            labelWidth={labelWidth}
            barAreaWidth={barAreaWidth}
            xScale={xScale}
            height={height}
            valueLabel={valueLabel}
          />
        )
      }}
    </ChartCard>
  )
}

function HorizontalBarInner({
  items,
  barColor,
  width,
  labelWidth,
  barAreaWidth,
  xScale,
  height,
  valueLabel,
}: {
  items: ReadonlyArray<BarItem>
  barColor?: string
  width: number
  labelWidth: number
  barAreaWidth: number
  xScale: ReturnType<typeof scaleLinear<number>>
  height: number
  valueLabel?: string
}) {
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } = useTooltip<BarItem>()
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  })
  const color = barColor ?? chartTheme.colors.accent

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg width={width} height={height} role="img" aria-label="Horizontal bar chart">
        {items.map((d, i) => {
          const y = i * ROW_HEIGHT
          const barWidth = Math.max(xScale(d.value), 2)
          const displayLabel = getDisplayLabel(d.label)
          const hasTechnologyIcon = Boolean(d.icon)
          const textWidth = estimateLabelWidth(displayLabel)
          const labelGroupWidth = hasTechnologyIcon ? ICON_SIZE + ICON_GAP + textWidth : textWidth
          const labelStartX = labelWidth - labelGroupWidth - LABEL_RIGHT_PADDING
          const textX = hasTechnologyIcon ? labelStartX + ICON_SIZE + ICON_GAP : labelStartX
          const iconX = labelStartX
          const iconY = (ROW_HEIGHT - ICON_SIZE) / 2

          return (
            <Group key={d.label} top={y}>
              {d.icon && (
                <svg
                  x={iconX}
                  y={iconY}
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  viewBox={`0 0 ${d.icon.width} ${d.icon.height}`}
                  aria-hidden="true"
                  dangerouslySetInnerHTML={{ __html: d.icon.body }}
                />
              )}

              {/* Truncated label */}
              {d.href ? (
                <a href={d.href} style={{ textDecoration: "none" }}>
                  <text
                    x={textX}
                    y={ROW_HEIGHT / 2}
                    textAnchor="start"
                    dominantBaseline="central"
                    fontSize={chartTheme.font.labelSize}
                    fontFamily={chartTheme.font.family}
                    fill={chartTheme.colors.text}
                    style={{ cursor: "pointer" }}
                  >
                    {displayLabel}
                  </text>
                </a>
              ) : (
                <text
                  x={textX}
                  y={ROW_HEIGHT / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fontSize={chartTheme.font.labelSize}
                  fontFamily={chartTheme.font.family}
                  fill={chartTheme.colors.text}
                >
                  {displayLabel}
                </text>
              )}

              {/* Bar background track */}
              <rect
                x={labelWidth}
                y={BAR_Y}
                width={barAreaWidth}
                height={BAR_HEIGHT}
                rx={chartTheme.bar.radius}
                fill={chartTheme.colors.barBg}
              />

              {/* Bar */}
              <rect
                x={labelWidth}
                y={BAR_Y}
                width={barWidth}
                height={BAR_HEIGHT}
                rx={chartTheme.bar.radius}
                fill={color}
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => {
                  showTooltip({
                    tooltipData: d,
                    tooltipLeft: e.clientX,
                    tooltipTop: e.clientY,
                  })
                }}
                onMouseLeave={hideTooltip}
              />

              {/* Value */}
              <text
                x={labelWidth + barAreaWidth + 8}
                y={ROW_HEIGHT / 2}
                textAnchor="start"
                dominantBaseline="central"
                fontSize={chartTheme.font.valueSize}
                fontFamily={chartTheme.font.mono}
                fill={chartTheme.colors.textMuted}
              >
                {d.value.toLocaleString()}
              </text>
            </Group>
          )
        })}
      </svg>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          left={tooltipLeft}
          top={tooltipTop}
          style={{
            background: chartTheme.colors.text,
            color: "#fff",
            padding: "6px 10px",
            borderRadius: "var(--radius-overlay)",
            fontSize: "12px",
            fontFamily: chartTheme.font.family,
            pointerEvents: "none",
          }}
        >
          <strong>{tooltipData.label}</strong>
          <br />
          {tooltipData.value.toLocaleString()} {valueLabel ?? ""}
        </TooltipInPortal>
      )}
    </div>
  )
}
