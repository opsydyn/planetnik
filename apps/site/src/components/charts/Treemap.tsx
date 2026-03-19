import { Group } from "@visx/group"
import { useTooltip, useTooltipInPortal } from "@visx/tooltip"
import { hierarchy, treemap, treemapSquarify, type HierarchyRectangularNode } from "d3-hierarchy"
import ChartCard from "./ChartCard"
import { chartTheme } from "./theme"

interface TreemapItem {
  label: string
  value: number
  group?: string
}

interface TreemapChartProps {
  data: TreemapItem[]
  valueLabel?: string
  helpText?: string
}

interface TreeNode {
  name: string
  children?: TreeNode[]
  value?: number
  group?: string
}

const PALETTE = chartTheme.colors.palette

export default function TreemapChart({ data, valueLabel, helpText }: TreemapChartProps) {
  if (data.length === 0) return null

  return (
    <ChartCard height={400} helpText={helpText}>
      {(width) => <TreemapInner data={data} valueLabel={valueLabel} width={width} height={400} />}
    </ChartCard>
  )
}

function TreemapInner({
  data,
  valueLabel,
  width,
  height,
}: TreemapChartProps & { width: number; height: number }) {
  const { tooltipOpen, tooltipLeft, tooltipTop, tooltipData, showTooltip, hideTooltip } =
    useTooltip<TreemapItem>()
  const { containerRef, TooltipInPortal } = useTooltipInPortal({ detectBounds: true, scroll: true })

  // Build hierarchy: group items if they have groups, otherwise flat
  const groups = new Map<string, TreemapItem[]>()
  for (const item of data) {
    const g = item.group ?? "__root__"
    const list = groups.get(g) ?? []
    list.push(item)
    groups.set(g, list)
  }

  let rootNode: TreeNode
  if (groups.size === 1 && groups.has("__root__")) {
    rootNode = {
      name: "root",
      children: data.map((d) => ({ name: d.label, value: d.value, group: d.group })),
    }
  } else {
    rootNode = {
      name: "root",
      children: Array.from(groups.entries()).map(([groupName, items]) => ({
        name: groupName,
        children: items.map((d) => ({ name: d.label, value: d.value, group: d.group })),
      })),
    }
  }

  const root = hierarchy<TreeNode>(rootNode)
    .sum((d) => d.value ?? 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const tree = treemap<TreeNode>()
    .tile(treemapSquarify)
    .size([width, height])
    .padding(2)
    .paddingInner(1)(root)

  const leaves = tree.leaves()

  // Assign colors by group or by index
  const uniqueGroups = Array.from(new Set(data.map((d) => d.group ?? d.label)))
  const groupColorMap = new Map(uniqueGroups.map((g, i) => [g, PALETTE[i % PALETTE.length]]))

  return (
    <div ref={containerRef} style={{ position: "relative" }}>
      <svg width={width} height={height}>
        {leaves.map((leaf: HierarchyRectangularNode<TreeNode>, i: number) => {
          const w = leaf.x1 - leaf.x0
          const h = leaf.y1 - leaf.y0
          const colorKey = leaf.data.group ?? leaf.data.name
          const color = groupColorMap.get(colorKey) ?? PALETTE[i % PALETTE.length]
          const showLabel = w > 40 && h > 20

          return (
            <Group key={i} left={leaf.x0} top={leaf.y0}>
              <rect
                width={w}
                height={h}
                rx={3}
                fill={color}
                fillOpacity={0.85}
                stroke={chartTheme.colors.card}
                strokeWidth={1}
                style={{ cursor: "pointer" }}
                onMouseMove={(e) => {
                  showTooltip({
                    tooltipData: { label: leaf.data.name, value: leaf.value ?? 0, group: leaf.data.group },
                    tooltipLeft: e.clientX,
                    tooltipTop: e.clientY,
                  })
                }}
                onMouseLeave={hideTooltip}
              />
              {showLabel && (
                <>
                  <text
                    x={4}
                    y={14}
                    fontSize={11}
                    fontFamily={chartTheme.font.family}
                    fontWeight={500}
                    fill="#fff"
                    style={{ pointerEvents: "none" }}
                  >
                    {leaf.data.name.length > Math.floor(w / 7)
                      ? `${leaf.data.name.slice(0, Math.floor(w / 7) - 1)}…`
                      : leaf.data.name}
                  </text>
                  {h > 34 && (
                    <text
                      x={4}
                      y={28}
                      fontSize={10}
                      fontFamily={chartTheme.font.mono}
                      fill="rgba(255,255,255,0.8)"
                      style={{ pointerEvents: "none" }}
                    >
                      {(leaf.value ?? 0).toLocaleString()}
                    </text>
                  )}
                </>
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
          {tooltipData.group && (
            <>
              <br />
              <span style={{ opacity: 0.7 }}>{tooltipData.group}</span>
            </>
          )}
          <br />
          {tooltipData.value.toLocaleString()} {valueLabel ?? ""}
        </TooltipInPortal>
      )}
    </div>
  )
}
