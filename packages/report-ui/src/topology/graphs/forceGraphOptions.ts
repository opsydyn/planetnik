import { DEFAULT_STYLES, type SigmaOptions } from "sigma/types"

const labelVisibility = (_attributes: unknown, { isHovered }: { isHovered: boolean }) =>
  isHovered ? "visible" : "auto"
const backdropVisibility = (_attributes: unknown, { isHovered }: { isHovered: boolean }) =>
  isHovered ? "visible" : "hidden"

export function createForceGraphOptions({
  isLargeGraph,
  isDenseGraph,
  theme,
  text,
}: {
  isLargeGraph: boolean
  isDenseGraph: boolean
  theme: "light" | "dark"
  text: string
}) {
  const isDark = theme === "dark"

  return {
    settings: {
      allowInvalidContainer: true,
      renderEdgeLabels: false,
      enableEdgeEvents: !isLargeGraph,
      stagePadding: 32,
      minCameraRatio: 0.08,
      maxCameraRatio: 4,
      labelDensity: isDenseGraph ? 0.18 : isLargeGraph ? 0.32 : 1.1,
      labelRenderedSizeThreshold: isDenseGraph ? 14 : isLargeGraph ? 12 : 0,
    },
    styles: {
      nodes: {
        ...DEFAULT_STYLES.nodes,
        size: { attribute: "size" },
        color: { attribute: "color", defaultValue: "#58A6FF" },
        labelFont: "600 Inter, system-ui, sans-serif",
        labelSize: isLargeGraph ? 12 : 13,
        labelColor: text,
        labelVisibility,
        backdropVisibility,
        backdropColor: isDark ? "#1e293b" : "#ffffff",
        backdropShadowColor: isDark ? "rgba(0,0,0,0.6)" : "rgba(0,0,0,0.2)",
        backdropShadowBlur: 8,
        backdropPadding: 3,
        backdropBorderColor: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.2)",
        backdropBorderWidth: 1.5,
      },
      edges: {
        ...DEFAULT_STYLES.edges,
        color: {
          attribute: "color",
          defaultValue: isDark ? "rgba(167, 139, 250, 0.44)" : "rgba(67, 56, 202, 0.38)",
        },
      },
    },
  } satisfies SigmaOptions
}
