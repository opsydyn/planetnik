import { useEffect, useRef, useState, type ReactNode } from "react"
import { chartTheme } from "./theme"

interface ChartCardProps {
  title?: string
  height?: number
  children: (width: number, height: number) => ReactNode
}

export default function ChartCard({ title, height = 200, children }: ChartCardProps) {
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
                borderRadius: "14px",
                border: `1px solid ${chartTheme.colors.border}`,
                background:
                  "linear-gradient(110deg, #f8fafc 10%, #eef2ff 28%, #f8fafc 44%, #eef2ff 60%, #f8fafc 76%)",
                backgroundSize: "200% 100%",
                animation: "planetnik-chart-skeleton 1.6s ease-in-out infinite",
              }}
            />
            <div style={{ display: "flex", gap: "0.6rem", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: "0.45rem" }}>
                {Array.from({ length: 4 }).map((_, index) => (
                  <span
                    key={index}
                    style={{
                      width: "2.75rem",
                      height: "0.75rem",
                      borderRadius: "999px",
                      background: index === 0 ? "#dbeafe" : "#e2e8f0",
                    }}
                  />
                ))}
              </div>
              <span
                style={{
                  width: "4.25rem",
                  height: "0.85rem",
                  borderRadius: "999px",
                  background: "#e2e8f0",
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
