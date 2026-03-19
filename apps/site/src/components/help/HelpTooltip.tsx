import { Drawer } from "@base-ui/react/drawer"
import { useEffect, useState } from "react"
import { chartTheme } from "../charts/theme"
import "./HelpTooltip.css"

interface HelpTooltipProps {
  text: string
  label?: string
}

const MOBILE_HELP_QUERY = "(max-width: 767px), (hover: none), (pointer: coarse)"

export default function HelpTooltip({
  text,
  label = "How to read this chart",
}: HelpTooltipProps) {
  const [tooltipOpen, setTooltipOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [useDrawer, setUseDrawer] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return

    const mediaQuery = window.matchMedia(MOBILE_HELP_QUERY)
    const updateMode = () => {
      setUseDrawer(mediaQuery.matches)
    }

    updateMode()

    mediaQuery.addEventListener("change", updateMode)
    return () => mediaQuery.removeEventListener("change", updateMode)
  }, [])

  useEffect(() => {
    if (useDrawer) {
      setTooltipOpen(false)
      return
    }

    setDrawerOpen(false)
  }, [useDrawer])

  function handleMouseEnter() {
    if (useDrawer) return
    setTooltipOpen(true)
  }

  function handleMouseLeave() {
    if (useDrawer) return
    setTooltipOpen(false)
  }

  function handleFocus() {
    if (useDrawer) return
    setTooltipOpen(true)
  }

  function handleBlur() {
    if (useDrawer) return
    setTooltipOpen(false)
  }

  function handleClick() {
    if (!useDrawer) return
    setDrawerOpen(true)
  }

  return (
    <>
      <div
        className="help-tooltip"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
      <button
        type="button"
        aria-label={label}
        aria-expanded={useDrawer ? drawerOpen : tooltipOpen}
        aria-haspopup={useDrawer ? "dialog" : "true"}
        className="help-tooltip__trigger"
        onFocus={handleFocus}
        onBlur={handleBlur}
        onClick={handleClick}
        style={{
          border: `1px solid ${chartTheme.colors.border}`,
          color: chartTheme.colors.textMuted,
          boxShadow: tooltipOpen || drawerOpen ? "0 8px 24px rgba(15, 23, 42, 0.12)" : "none",
        }}
      >
        ?
      </button>

      {tooltipOpen && (
        <div
          role="tooltip"
          className="help-tooltip__bubble"
          style={{
            border: `1px solid ${chartTheme.colors.border}`,
            color: chartTheme.colors.text,
          }}
        >
          {text}
        </div>
      )}
      </div>

      <Drawer.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Backdrop className="help-drawer__backdrop" />
          <Drawer.Viewport className="help-drawer__viewport">
            <Drawer.Popup className="help-drawer__popup">
              <div aria-hidden className="help-drawer__handle" />
              <Drawer.Content className="help-drawer__content">
                <Drawer.Title className="help-drawer__title">{label}</Drawer.Title>
                <Drawer.Description className="help-drawer__description">
                  {text}
                </Drawer.Description>
                <div className="help-drawer__actions">
                  <Drawer.Close className="help-drawer__close">Got it</Drawer.Close>
                </div>
              </Drawer.Content>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}
