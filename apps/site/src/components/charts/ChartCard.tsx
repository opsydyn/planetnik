import { ParentSize } from "@visx/responsive"
import type { ReactNode } from "react"
import { chartTheme } from "./theme"

interface ChartCardProps {
  title?: string
  height?: number
  children: (width: number, height: number) => ReactNode
}

export default function ChartCard({ title, height = 200, children }: ChartCardProps) {
  return (
    <div
      style={{
        background: chartTheme.colors.card,
        border: `1px solid ${chartTheme.colors.border}`,
        borderRadius: "8px",
        padding: "1rem",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: "0.8rem",
            fontWeight: 600,
            color: chartTheme.colors.textMuted,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            marginBottom: "0.75rem",
          }}
        >
          {title}
        </div>
      )}
      <ParentSize>{({ width }) => (width > 0 ? children(width, height) : null)}</ParentSize>
    </div>
  )
}
