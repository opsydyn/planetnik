import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridColumns, GridRows } from "@visx/grid"
import { Group } from "@visx/group"
import { scaleLinear } from "@visx/scale"
import { useTooltip, useTooltipInPortal } from "@visx/tooltip"
import { maxOf } from "../../lib/arrayMath"
import ChartCard from "./ChartCard"
import { chartTheme } from "./theme"

interface ScatterPoint {
  x: number
  y: number
  label: string
}

interface ScatterPlotProps {
  data: ReadonlyArray<ScatterPoint>
  xLabel: string
  yLabel: string
  thresholds?: { x?: number; y?: number }
  helpText?: string
}

const MARGIN = { top: 16, right: 16, bottom: 40, left: 50 }

export default function ScatterPlot({ data, xLabel, yLabel, thresholds, helpText }: ScatterPlotProps) {
  return (
    <ChartCard height={400} helpText={helpText}>
      {(width) => (
        <ScatterInner data={data} xLabel={xLabel} yLabel={yLabel} thresholds={thresholds} width={width} height={400} />
      )}
    </ChartCard>
  )
}

function ScatterInner({
  data,
  xLabel,
  yLabel,
  thresholds,
  width,
  height,
}: ScatterPlotProps & { width: number; height: number }) {
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } = useTooltip<ScatterPoint>()
  const { containerRef, TooltipInPortal } = useTooltipInPortal({
    detectBounds: true,
    scroll: true,
  })

  const innerWidth = width - MARGIN.left - MARGIN.right
  const innerHeight = height - MARGIN.top - MARGIN.bottom

  const maxX = maxOf(
    data.map((d) => d.x),
    1,
  )
  const maxY = maxOf(
    data.map((d) => d.y),
    1,
  )

  const xScale = scaleLinear({
    domain: [0, maxX * 1.05],
    range: [0, innerWidth],
  })
  const yScale = scaleLinear({
    domain: [0, maxY * 1.05],
    range: [innerHeight, 0],
  })

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg width={width} height={height} role="img" aria-label="Scatter plot">
        <Group left={MARGIN.left} top={MARGIN.top}>
          <GridRows scale={yScale} width={innerWidth} stroke={chartTheme.colors.border} strokeOpacity={0.5} />
          <GridColumns scale={xScale} height={innerHeight} stroke={chartTheme.colors.border} strokeOpacity={0.5} />

          {/* Threshold lines */}
          {thresholds?.x != null && (
            <line
              x1={xScale(thresholds.x)}
              x2={xScale(thresholds.x)}
              y1={0}
              y2={innerHeight}
              stroke={chartTheme.colors.orange}
              strokeWidth={1.5}
              strokeDasharray="6,4"
              opacity={0.6}
            />
          )}
          {thresholds?.y != null && (
            <line
              x1={0}
              x2={innerWidth}
              y1={yScale(thresholds.y)}
              y2={yScale(thresholds.y)}
              stroke={chartTheme.colors.orange}
              strokeWidth={1.5}
              strokeDasharray="6,4"
              opacity={0.6}
            />
          )}

          {/* Data points */}
          {data.map((d) => {
            const cx = xScale(d.x)
            const cy = yScale(d.y)
            const isAboveThreshold =
              (thresholds?.y != null && d.y > thresholds.y) || (thresholds?.x != null && d.x > thresholds.x)

            return (
              <circle
                key={`${d.label}-${d.x}-${d.y}`}
                cx={cx}
                cy={cy}
                r={4}
                fill={isAboveThreshold ? chartTheme.colors.red : chartTheme.colors.accent}
                fillOpacity={0.6}
                stroke={isAboveThreshold ? chartTheme.colors.red : chartTheme.colors.accent}
                strokeWidth={1}
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
            )
          })}

          <AxisBottom
            top={innerHeight}
            scale={xScale}
            label={xLabel}
            labelProps={{
              fontSize: chartTheme.font.labelSize,
              fontFamily: chartTheme.font.family,
              fill: chartTheme.colors.textMuted,
              textAnchor: "middle",
            }}
            tickLabelProps={{
              fontSize: chartTheme.font.tickSize,
              fontFamily: chartTheme.font.mono,
              fill: chartTheme.colors.textMuted,
              textAnchor: "middle",
            }}
            stroke={chartTheme.colors.border}
            tickStroke={chartTheme.colors.border}
          />
          <AxisLeft
            scale={yScale}
            label={yLabel}
            labelProps={{
              fontSize: chartTheme.font.labelSize,
              fontFamily: chartTheme.font.family,
              fill: chartTheme.colors.textMuted,
              textAnchor: "middle",
            }}
            tickLabelProps={{
              fontSize: chartTheme.font.tickSize,
              fontFamily: chartTheme.font.mono,
              fill: chartTheme.colors.textMuted,
              textAnchor: "end",
            }}
            stroke={chartTheme.colors.border}
            tickStroke={chartTheme.colors.border}
          />
        </Group>
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
          {xLabel}: {tooltipData.x.toLocaleString()}
          <br />
          {yLabel}: {tooltipData.y.toLocaleString()}
        </TooltipInPortal>
      )}
    </div>
  )
}
