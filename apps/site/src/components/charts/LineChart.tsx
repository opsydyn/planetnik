import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridRows } from "@visx/grid"
import { Group } from "@visx/group"
import { scaleLinear, scalePoint } from "@visx/scale"
import { LinePath } from "@visx/shape"
import { useTooltip, useTooltipInPortal } from "@visx/tooltip"
import { maxOf } from "../../lib/arrayMath"
import ChartCard from "./ChartCard"
import { chartTheme } from "./theme"

interface DataPoint {
  label: string
  value: number
}

interface LineSeries {
  name: string
  data: DataPoint[]
  color?: string
}

interface LineChartProps {
  series: ReadonlyArray<LineSeries>
  xLabel?: string
  yLabel?: string
  height?: number
  helpText?: string
}

const MARGIN = { top: 20, right: 20, bottom: 50, left: 50 }

export default function LineChart({ series, xLabel, yLabel, height = 280, helpText }: LineChartProps) {
  if (series.length === 0 || series.every((s) => s.data.length === 0)) return null

  return (
    <ChartCard height={height} helpText={helpText}>
      {(width) => <LineChartInner series={series} xLabel={xLabel} yLabel={yLabel} width={width} height={height} />}
    </ChartCard>
  )
}

function LineChartInner({ series, xLabel, yLabel, width, height }: LineChartProps & { width: number; height: number }) {
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } = useTooltip<{
    series: string
    label: string
    value: number
  }>()
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  })

  const innerWidth = width - MARGIN.left - MARGIN.right
  const innerHeight = height - MARGIN.top - MARGIN.bottom

  // Use all unique labels from all series as x-axis domain
  const allLabels = Array.from(new Set(series.flatMap((s) => s.data.map((d) => d.label))))

  const xScale = scalePoint({
    domain: allLabels,
    range: [0, innerWidth],
    padding: 0.1,
  })

  const maxValue = maxOf(
    series.flatMap((s) => s.data.map((d) => d.value)),
    1,
  )
  const yScale = scaleLinear({
    domain: [0, maxValue * 1.1],
    range: [innerHeight, 0],
    nice: true,
  })

  const PALETTE = chartTheme.colors.palette

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg width={width} height={height} role="img" aria-label="Line chart">
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={yScale} width={innerWidth} stroke={chartTheme.colors.border} strokeDasharray="3,3" />

          {series.map((s, si) => {
            const color = s.color ?? PALETTE[si % PALETTE.length]
            return (
              <g key={s.name}>
                <LinePath
                  data={s.data}
                  x={(d) => xScale(d.label) ?? 0}
                  y={(d) => yScale(d.value)}
                  stroke={color}
                  strokeWidth={2}
                  curve={undefined}
                />
                {s.data.map((d) => (
                  <circle
                    key={`${s.name}-${d.label}`}
                    cx={xScale(d.label) ?? 0}
                    cy={yScale(d.value)}
                    r={3.5}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={1.5}
                    style={{ cursor: "pointer" }}
                    onMouseMove={(e) =>
                      showTooltip({
                        tooltipData: {
                          series: s.name,
                          label: d.label,
                          value: d.value,
                        },
                        tooltipLeft: e.clientX,
                        tooltipTop: e.clientY,
                      })
                    }
                    onMouseLeave={hideTooltip}
                  />
                ))}
              </g>
            )
          })}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            tickLabelProps={() => ({
              fontSize: chartTheme.font.tickSize,
              fontFamily: chartTheme.font.family,
              fill: chartTheme.colors.textMuted,
              textAnchor: "end" as const,
              angle: -45,
              dy: "0.25em",
              dx: "-0.25em",
            })}
            stroke={chartTheme.colors.border}
            tickStroke={chartTheme.colors.border}
            label={xLabel}
            labelProps={{
              fontSize: chartTheme.font.labelSize,
              fontFamily: chartTheme.font.family,
              fill: chartTheme.colors.textMuted,
              textAnchor: "middle",
            }}
          />
          <AxisLeft
            scale={yScale}
            tickLabelProps={() => ({
              fontSize: chartTheme.font.tickSize,
              fontFamily: chartTheme.font.family,
              fill: chartTheme.colors.textMuted,
              textAnchor: "end" as const,
              dx: "-0.25em",
            })}
            stroke={chartTheme.colors.border}
            tickStroke={chartTheme.colors.border}
            label={yLabel}
            labelProps={{
              fontSize: chartTheme.font.labelSize,
              fontFamily: chartTheme.font.family,
              fill: chartTheme.colors.textMuted,
              textAnchor: "middle",
            }}
          />
        </Group>
      </svg>

      {/* Legend */}
      {series.length > 1 && (
        <div
          style={{
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
            marginTop: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          {series.map((s, si) => (
            <div
              key={s.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "11px",
                fontFamily: chartTheme.font.family,
              }}
            >
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "var(--radius-inline)",
                  background: s.color ?? PALETTE[si % PALETTE.length],
                }}
              />
              <span style={{ color: chartTheme.colors.text }}>{s.name}</span>
            </div>
          ))}
        </div>
      )}

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
          {series.length > 1 && (
            <>
              <strong>{tooltipData.series}</strong>
              <br />
            </>
          )}
          {tooltipData.label}: <strong>{tooltipData.value.toLocaleString()}</strong>
        </TooltipInPortal>
      )}
    </div>
  )
}
