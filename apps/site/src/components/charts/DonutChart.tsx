import { Group } from "@visx/group"
import { Pie } from "@visx/shape"
import { useTooltip, useTooltipInPortal } from "@visx/tooltip"
import ChartCard from "./ChartCard"
import { chartTheme } from "./theme"

interface DonutItem {
  label: string
  value: number
}

interface DonutChartProps {
  data: DonutItem[]
  valueLabel?: string
}

const PALETTE = chartTheme.colors.palette
const DONUT_THICKNESS = 40

export default function DonutChart({ data, valueLabel }: DonutChartProps) {
  if (data.length === 0) return null

  return (
    <ChartCard height={300}>
      {(width) => <DonutInner data={data} valueLabel={valueLabel} width={width} height={300} />}
    </ChartCard>
  )
}

function DonutInner({
  data,
  valueLabel,
  width,
  height,
}: DonutChartProps & { width: number; height: number }) {
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } =
    useTooltip<DonutItem & { percentage: number }>()
  const { containerRef, TooltipInPortal } = useTooltipInPortal({ detectBounds: true, scroll: true })

  const total = data.reduce((s, d) => s + d.value, 0)
  const legendWidth = 160
  const chartArea = Math.min(width - legendWidth, height)
  const radius = chartArea / 2 - 8
  const innerRadius = radius - DONUT_THICKNESS
  const centerX = chartArea / 2
  const centerY = height / 2

  return (
    <div ref={containerRef} style={{ position: "relative", display: "flex", alignItems: "center", gap: "1rem" }}>
      <svg width={chartArea} height={height}>
        <Group left={centerX} top={centerY}>
          <Pie
            data={data}
            pieValue={(d) => d.value}
            outerRadius={radius}
            innerRadius={innerRadius}
            cornerRadius={3}
            padAngle={0.02}
          >
            {(pie) =>
              pie.arcs.map((arc, i) => {
                const path = pie.path(arc) ?? ""
                const color = PALETTE[i % PALETTE.length]
                return (
                  <path
                    key={arc.data.label}
                    d={path}
                    fill={color}
                    style={{ cursor: "pointer" }}
                    onMouseMove={(e) => {
                      showTooltip({
                        tooltipData: {
                          ...arc.data,
                          percentage: total > 0 ? (arc.data.value / total) * 100 : 0,
                        },
                        tooltipLeft: e.clientX,
                        tooltipTop: e.clientY,
                      })
                    }}
                    onMouseLeave={hideTooltip}
                  />
                )
              })
            }
          </Pie>
          {/* Center total */}
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

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: legendWidth }}>
        {data.slice(0, 10).map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0"
          return (
            <div
              key={d.label}
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
                  background: PALETTE[i % PALETTE.length],
                  flexShrink: 0,
                }}
              />
              <span style={{ color: chartTheme.colors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                {d.label}
              </span>
              <span style={{ color: chartTheme.colors.textMuted, fontFamily: chartTheme.font.mono, fontSize: "10px" }}>
                {pct}%
              </span>
            </div>
          )
        })}
        {data.length > 10 && (
          <div style={{ fontSize: "10px", color: chartTheme.colors.textMuted, fontStyle: "italic" }}>
            +{data.length - 10} more
          </div>
        )}
      </div>

      {tooltipOpen && tooltipData && (
        <TooltipInPortal
          left={tooltipLeft}
          top={tooltipTop}
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
      )}
    </div>
  )
}
