import { type ReactNode, useEffect, useRef, useState } from "react"
import HelpTooltip from "../help/HelpTooltip"
import { chartTheme } from "./theme"

interface ChartCardProps {
  title?: string
  helpText?: string
  height?: number
  children: (width: number, height: number) => ReactNode
}

export default function ChartCard({ title, helpText, height = 200, children }: ChartCardProps) {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = frameRef.current
    if (!element) return

    function updateWidth() {
      const currentElement = frameRef.current
      if (!currentElement) return
      setWidth(currentElement.clientWidth)
    }

    updateWidth()

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth)
      return () => window.removeEventListener("resize", updateWidth)
    }

    const observer = new ResizeObserver(() => {
      updateWidth()
    })

    observer.observe(element)

    return () => observer.disconnect()
  }, [])

  const isReady = width > 0

  return (
    <div
      style={{
        background: chartTheme.colors.card,
        border: `1px solid ${chartTheme.colors.border}`,
        borderRadius: "var(--radius-card)",
        padding: "1rem",
      }}
    >
      {(title || helpText) && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginBottom: "0.75rem",
            position: "relative",
          }}
        >
          <div
            style={{
              fontSize: "0.8rem",
              fontWeight: 600,
              color: chartTheme.colors.textMuted,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              minHeight: "1.5rem",
            }}
          >
            {title ?? ""}
          </div>

          {helpText && <HelpTooltip text={helpText} />}
        </div>
      )}
      <div
        ref={frameRef}
        aria-busy={!isReady}
        style={{
          position: "relative",
          minHeight: `${height}px`,
        }}
      >
        <div
          style={{
            opacity: isReady ? 1 : 0,
            transition: "opacity 180ms ease",
          }}
        >
          {isReady ? children(width, height) : null}
        </div>

        {!isReady && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              gridTemplateRows: "1fr auto",
              gap: "0.85rem",
              pointerEvents: "none",
            }}
          >
            <div
              style={{
                minHeight: `${Math.max(height - 28, 80)}px`,
                borderRadius: "var(--radius-overlay)",
                border: `1px solid ${chartTheme.colors.border}`,
                background:
                  "linear-gradient(110deg, var(--color-surface-subtle) 10%, var(--color-accent-soft) 28%, var(--color-surface-subtle) 44%, var(--color-accent-soft) 60%, var(--color-surface-subtle) 76%)",
                backgroundSize: "200% 100%",
                animation: "planetnik-chart-skeleton 1.6s ease-in-out infinite",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "0.6rem",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div style={{ display: "flex", gap: "0.45rem" }}>
                {["alpha", "beta", "gamma", "delta"].map((key, index) => (
                  <span
                    key={key}
                    style={{
                      width: "2.75rem",
                      height: "0.75rem",
                      borderRadius: "var(--radius-badge)",
                      background: index === 0 ? "var(--color-accent-soft)" : "var(--color-surface-muted)",
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  width: "4.25rem",
                  height: "0.85rem",
                  borderRadius: "var(--radius-badge)",
                  background: "var(--color-surface-muted)",
                }}
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes planetnik-chart-skeleton {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  )
}
