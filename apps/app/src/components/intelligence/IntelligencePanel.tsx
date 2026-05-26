import { useEffect, useMemo, useRef, useState } from "react"
import IntelligenceChat from "./IntelligenceChat"
import "./IntelligencePanel.css"
import { buildIntelligenceCapabilities, buildIntelligenceHeaderHint } from "./intelligenceUx"
import type { AnalysisContextProps } from "./useAnalysisContext"

interface Props extends AnalysisContextProps {
  runtimeUrl: string
  baseHref: string
  isLandscape: boolean
}

const OPEN_STORAGE_KEY = "planetnik.intelligence.open"
const EXPANDED_STORAGE_KEY = "planetnik.intelligence.expanded"

function readStoredBoolean(key: string, fallback: boolean) {
  const storedValue = window.sessionStorage.getItem(key)
  if (storedValue === "true") return true
  if (storedValue === "false") return false
  return fallback
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement)
  )
}

function getShortcutLabel() {
  if (typeof navigator !== "undefined" && /mac/i.test(navigator.platform)) {
    return "⌘I"
  }

  return "Ctrl+I"
}

function ChatIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M128,24A104,104,0,0,0,36.18,176.88L24.83,210.93a16,16,0,0,0,20.24,20.24l34.05-11.35A104,104,0,1,0,128,24Zm0,192a87.87,87.87,0,0,1-44.06-11.81,8,8,0,0,0-4-1.08,8.09,8.09,0,0,0-2.53.41L40,216l12.47-37.4a8,8,0,0,0-.66-6.54A88,88,0,1,1,128,216Z" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="20"
      height="20"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M216,48V88a8,8,0,0,1-16,0V67.31l-42.34,42.35a8,8,0,0,1-11.32-11.32L188.69,56H168a8,8,0,0,1,0-16h40A8,8,0,0,1,216,48ZM98.34,146.34,56,188.69V168a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H88a8,8,0,0,0,0-16H67.31l42.35-42.34a8,8,0,0,0-11.32-11.32Z" />
    </svg>
  )
}

function ShrinkIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 256 256"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M144,104V64a8,8,0,0,1,16,0V84.69l42.34-42.35a8,8,0,0,1,11.32,11.32L171.31,96H192a8,8,0,0,1,0,16H152A8,8,0,0,1,144,104ZM42.34,213.66,84.69,171.31V192a8,8,0,0,0,16,0V152a8,8,0,0,0-8-8H52a8,8,0,0,0,0,16H72.69L30.34,202.34a8,8,0,0,0,11.32,11.32Z" />
    </svg>
  )
}

export default function IntelligencePanel({ runtimeUrl, baseHref, isLandscape, ...dataProps }: Props) {
  const [open, setOpen] = useState(() => readStoredBoolean(OPEN_STORAGE_KEY, false))
  const [expanded, setExpanded] = useState(() => readStoredBoolean(EXPANDED_STORAGE_KEY, false))
  const mounted = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const capabilities = buildIntelligenceCapabilities(dataProps, isLandscape)
  const headerHint = buildIntelligenceHeaderHint(capabilities)
  const shortcutLabel = useMemo(() => getShortcutLabel(), [])

  if (open && !mounted.current) {
    mounted.current = true
  }

  const panelClasses = [
    "intelligence-panel",
    open && "intelligence-panel--open",
    expanded && "intelligence-panel--expanded",
  ]
    .filter(Boolean)
    .join(" ")

  useEffect(() => {
    window.sessionStorage.setItem(OPEN_STORAGE_KEY, String(open))
  }, [open])

  useEffect(() => {
    window.sessionStorage.setItem(EXPANDED_STORAGE_KEY, String(expanded))
  }, [expanded])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return
      if (isEditableTarget(event.target)) return

      const isToggleShortcut =
        (event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "i"

      if (isToggleShortcut) {
        event.preventDefault()
        setOpen((current) => !current)
        return
      }

      if (event.key === "Escape") {
        setOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  useEffect(() => {
    if (!open) return

    const rafId = window.requestAnimationFrame(() => {
      const input = panelRef.current?.querySelector<HTMLTextAreaElement | HTMLInputElement>("textarea, input")
      input?.focus()
    })

    return () => window.cancelAnimationFrame(rafId)
  }, [open])

  if (!runtimeUrl) return null

  return (
    <>
      <button
        type="button"
        className={`intelligence-fab ${open ? "intelligence-fab--hidden" : ""}`}
        onClick={() => setOpen(true)}
        aria-label="Ask Płanetnik"
        aria-keyshortcuts="Meta+I Control+I"
        title={`Ask Płanetnik (${shortcutLabel})`}
      >
        <ChatIcon />
      </button>

      <div className={panelClasses} ref={panelRef}>
        <div className="intelligence-panel-header">
          <div className="intelligence-panel-brand">
            <span className="intelligence-panel-title">Płanetnik</span>
            <span className="intelligence-panel-subtitle">{headerHint}</span>
          </div>
          <div className="intelligence-panel-actions">
            <button
              type="button"
              className="intelligence-panel-action"
              onClick={() => setExpanded((e) => !e)}
              aria-label={expanded ? "Shrink chat" : "Expand chat"}
              title={expanded ? "Shrink" : "Expand"}
            >
              {expanded ? <ShrinkIcon /> : <ExpandIcon />}
            </button>
            <button
              type="button"
              className="intelligence-panel-action"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              aria-keyshortcuts="Escape"
              title="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        {capabilities.length > 0 && (
          <div className="intelligence-panel-context">
            {capabilities.map((capability) => (
              <span key={capability} className="intelligence-panel-context-pill">
                {capability}
              </span>
            ))}
            <span className="intelligence-panel-shortcut">{shortcutLabel}</span>
          </div>
        )}
        <div className="intelligence-panel-body" style={{ display: open ? undefined : "none" }}>
          {mounted.current && (
            <IntelligenceChat runtimeUrl={runtimeUrl} baseHref={baseHref} isLandscape={isLandscape} {...dataProps} />
          )}
        </div>
      </div>
    </>
  )
}
