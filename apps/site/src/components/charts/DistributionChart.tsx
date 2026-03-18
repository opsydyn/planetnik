import { Group } from "@visx/group"
import { scaleLinear } from "@visx/scale"
import { useTooltip, useTooltipInPortal } from "@visx/tooltip"
import ChartCard from "./ChartCard"
import { chartTheme } from "./theme"

interface DistributionItem {
  label: string
  value: number
  detail: string
  detailSecondary?: string
  color?: string
}

interface DistributionChartProps {
  data: DistributionItem[]
  barColor?: string
}

const LABEL_WIDTH = 110
const DETAIL_WIDTH = 80
const DETAIL_SECONDARY_WIDTH = 100
const ROW_HEIGHT = 32
const BAR_HEIGHT = 18
const BAR_PADDING = (ROW_HEIGHT - BAR_HEIGHT) / 2

export default function DistributionChart({ data, barColor }: DistributionChartProps) {
  const hasSecondary = data.some((d) => d.detailSecondary)
  const totalDetailWidth = DETAIL_WIDTH + (hasSecondary ? DETAIL_SECONDARY_WIDTH : 0)
  const height = data.length * ROW_HEIGHT

  return (
    <ChartCard height={height}>
      {(width) => {
        const barAreaWidth = Math.max(width - LABEL_WIDTH - totalDetailWidth - 16, 40)

        const maxValue = Math.max(...data.map((d) => d.value), 1)
        const xScale = scaleLinear({ domain: [0, maxValue], range: [0, barAreaWidth] })

        return (
          <DistributionInner
            data={data}
            barColor={barColor}
            width={width}
            barAreaWidth={barAreaWidth}
            xScale={xScale}
            hasSecondary={hasSecondary}
            height={height}
          />
        )
      }}
    </ChartCard>
  )
}

function DistributionInner({
  data,
  barColor,
  width,
  barAreaWidth,
  xScale,
  hasSecondary,
  height,
}: {
  data: DistributionItem[]
  barColor?: string
  width: number
  barAreaWidth: number
  xScale: ReturnType<typeof scaleLinear<number>>
  hasSecondary: boolean
  height: number
}) {
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } = useTooltip<DistributionItem>()
  const { containerRef, TooltipInPortal } = useTooltipInPortal({ detectBounds: true, scroll: true })

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg width={width} height={height}>
        {data.map((d, i) => {
          const y = i * ROW_HEIGHT
          const barWidth = Math.max(xScale(d.value), 2)
          const color = d.color ?? barColor ?? chartTheme.colors.accent

          return (
            <Group key={d.label} top={y}>
              {/* Label */}
              <text
                x={LABEL_WIDTH - 8}
                y={ROW_HEIGHT / 2}
                textAnchor="end"
                dominantBaseline="central"
                fontSize={chartTheme.font.labelSize}
                fontFamily={chartTheme.font.family}
                fill={chartTheme.colors.textMuted}
              >
                {d.label}
              </text>

              {/* Bar background track */}
              <rect
                x={LABEL_WIDTH}
                y={BAR_PADDING}
                width={barAreaWidth}
                height={BAR_HEIGHT}
                rx={chartTheme.bar.radius}
                fill={chartTheme.colors.barBg}
              />

              {/* Bar */}
              <rect
                x={LABEL_WIDTH}
                y={BAR_PADDING}
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

              {/* Detail text */}
              <text
                x={LABEL_WIDTH + barAreaWidth + 8}
                y={ROW_HEIGHT / 2}
                textAnchor="start"
                dominantBaseline="central"
                fontSize={chartTheme.font.valueSize}
                fontFamily={chartTheme.font.mono}
                fill={chartTheme.colors.textMuted}
              >
                {d.detail}
              </text>

              {/* Secondary detail */}
              {hasSecondary && d.detailSecondary && (
                <text
                  x={LABEL_WIDTH + barAreaWidth + DETAIL_WIDTH + 8}
                  y={ROW_HEIGHT / 2}
                  textAnchor="start"
                  dominantBaseline="central"
                  fontSize={chartTheme.font.valueSize}
                  fontFamily={chartTheme.font.mono}
                  fill={chartTheme.colors.textMuted}
                >
                  {d.detailSecondary}
                </text>
              )}
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
            borderRadius: "4px",
            fontSize: "12px",
            fontFamily: chartTheme.font.family,
            pointerEvents: "none",
          }}
        >
          <strong>{tooltipData.label}</strong>
          <br />
          {tooltipData.detail}
          {tooltipData.detailSecondary && (
            <>
              <br />
              {tooltipData.detailSecondary}
            </>
          )}
        </TooltipInPortal>
      )}
    </div>
  )
}
