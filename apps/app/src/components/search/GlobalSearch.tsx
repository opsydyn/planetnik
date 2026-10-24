import { navigate } from "astro:transitions/client"
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass"
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap"
import { XIcon } from "@phosphor-icons/react/dist/csr/X"
import type { FuseResultMatch } from "fuse.js"
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from "react"
import type { SearchDocument, SearchDocumentKind } from "../../lib/search/types.js"
import { type LoadedSearchIndex, loadSearchIndex } from "./searchIndex.js"
import "./GlobalSearch.css"

type SearchResult = {
  item: SearchDocument
  matches?: readonly FuseResultMatch[]
}

const kindLabels: Record<SearchDocumentKind, string> = {
  page: "Pages",
  file: "Files",
  unit: "Units",
  contributor: "People",
  metric: "Metrics",
  extension: "Languages",
  repository: "Repositories",
  team: "Teams",
}

function getDefaultResults(documents: SearchDocument[]): SearchResult[] {
  return documents.slice(0, 12).map((item) => ({ item }))
}

function groupResults(
  results: SearchResult[],
): Array<{ label: string; items: Array<SearchResult & { index: number }> }> {
  const grouped = new Map<string, Array<SearchResult & { index: number }>>()
  results.forEach((result, index) => {
    const label = kindLabels[result.item.kind]
    const existing = grouped.get(label)
    const withIndex = { ...result, index }
    if (existing) {
      existing.push(withIndex)
      return
    }
    grouped.set(label, [withIndex])
  })
  return Array.from(grouped.entries()).map(([label, items]) => ({ label, items }))
}

function getFieldMatch(matches: readonly FuseResultMatch[] | undefined, key: "title" | "subtitle") {
  return matches?.find((match) => match.key === key && typeof match.value === "string")
}

function renderHighlightedText(text: string | undefined, match: FuseResultMatch | undefined) {
  if (!text) return null
  if (!match || typeof match.value !== "string" || match.indices.length === 0) return text

  const parts: React.ReactNode[] = []
  let cursor = 0

  match.indices.forEach(([start, end]) => {
    if (cursor < start) {
      parts.push(<span key={`text-${cursor}-${start}`}>{text.slice(cursor, start)}</span>)
    }
    parts.push(
      <mark key={`mark-${start}-${end}`} className="global-search-highlight">
        {text.slice(start, end + 1)}
      </mark>,
    )
    cursor = end + 1
  })

  if (cursor < text.length) {
    parts.push(<span key={`text-end-${cursor}`}>{text.slice(cursor)}</span>)
  }

  return parts
}

export default function GlobalSearch({ projectName, searchIndexUrl }: { projectName: string; searchIndexUrl: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedIndex, setLoadedIndex] = useState<{ url: string; index: LoadedSearchIndex } | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [shortcutLabel, setShortcutLabel] = useState("Ctrl K")
  const inputRef = useRef<HTMLInputElement | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([])
  const deferredQuery = useDeferredValue(query.trim())
  const dialogTitleId = useId()
  const index = loadedIndex?.url === searchIndexUrl ? loadedIndex.index : null
  const results = useMemo<SearchResult[]>(() => {
    if (!index) return []
    if (!deferredQuery) return getDefaultResults(index.documents)
    return index.fuse.search(deferredQuery).map((result) => ({ item: result.item, matches: result.matches }))
  }, [index, deferredQuery])
  const openSearch = useCallback(() => {
    if (isOpen) return
    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setIsOpen(true)
  }, [isOpen])

  useEffect(() => {
    setShortcutLabel(/mac|iphone|ipad|ipod/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K")
  }, [])

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        openSearch()
        return
      }
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [openSearch])

  useEffect(() => {
    if (!isOpen) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    const focusTimeout = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      window.clearTimeout(focusTimeout)
      document.body.style.overflow = previousOverflow
      const previousFocus = previousFocusRef.current
      if (previousFocus?.isConnected) previousFocus.focus()
      else triggerRef.current?.focus()
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setIsLoading(true)
    setError(null)

    loadSearchIndex(searchIndexUrl)
      .then((index) => {
        if (cancelled) return
        setLoadedIndex({ url: searchIndexUrl, index })
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "Failed to load search index")
        setIsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [isOpen, searchIndexUrl])

  useEffect(() => {
    if (results.length) setActiveIndex(0)
  }, [results])

  function handleResultClick(result: SearchResult) {
    navigate(result.item.route)
    setIsOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    const flat = results
    if (!flat.length) return
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((i) => {
        const next = (i + 1) % flat.length
        resultRefs.current[next]?.scrollIntoView({ block: "nearest" })
        return next
      })
    } else if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((i) => {
        const next = (i - 1 + flat.length) % flat.length
        resultRefs.current[next]?.scrollIntoView({ block: "nearest" })
        return next
      })
    } else if (event.key === "Enter") {
      event.preventDefault()
      const active = flat[activeIndex]
      if (active) handleResultClick(active)
    }
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return
    const controls = event.currentTarget.querySelectorAll<HTMLElement>("input, button:not([disabled])")
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  const grouped = groupResults(results)

  if (!isOpen) {
    return (
      <button
        type="button"
        ref={triggerRef}
        className="global-search-trigger"
        onClick={openSearch}
        aria-label={`Search ${projectName}`}
      >
        <MagnifyingGlassIcon size={16} weight="bold" />
        <span className="global-search-trigger-label">Search</span>
        <span className="global-search-trigger-shortcut">{shortcutLabel}</span>
      </button>
    )
  }

  return (
    <div className="global-search-root">
      <button
        type="button"
        className="global-search-overlay"
        aria-label="Close search"
        tabIndex={-1}
        onClick={() => setIsOpen(false)}
      />
      <div
        className="global-search-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="global-search-header">
          <span id={dialogTitleId} className="sr-only">
            Search {projectName}
          </span>
          <div className="global-search-input-wrap">
            <MagnifyingGlassIcon size={18} weight="bold" aria-hidden="true" />
            <input
              ref={inputRef}
              className="global-search-input"
              type="text"
              placeholder={`Search ${projectName}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label={`Search ${projectName}`}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <button
            type="button"
            className="global-search-close"
            onClick={() => setIsOpen(false)}
            aria-label="Close search"
          >
            <XIcon size={16} weight="bold" />
          </button>
        </div>

        {isLoading && (
          <div className="global-search-loading">
            <SpinnerGapIcon size={18} className="global-search-spinner" aria-hidden="true" />
            Loading…
          </div>
        )}

        {error && <div className="global-search-error">{error}</div>}

        {!isLoading && !error && results.length === 0 && deferredQuery && (
          <div className="global-search-empty">No results for "{deferredQuery}"</div>
        )}

        {!isLoading && !error && results.length > 0 && (
          <div className="global-search-results" role="listbox" aria-label="Search results">
            {grouped.map((group) => (
              <div key={group.label} className="global-search-group">
                <div className="global-search-group-label">{group.label}</div>
                {group.items.map((result) => {
                  const titleMatch = getFieldMatch(result.matches, "title")
                  const subtitleMatch = getFieldMatch(result.matches, "subtitle")
                  return (
                    <button
                      key={result.item.id}
                      ref={(el) => {
                        resultRefs.current[result.index] = el
                      }}
                      type="button"
                      className="global-search-result"
                      role="option"
                      aria-selected={result.index === activeIndex}
                      data-active={result.index === activeIndex}
                      onClick={() => handleResultClick(result)}
                    >
                      <div className="global-search-result-main">
                        <div className="global-search-result-title">
                          {renderHighlightedText(result.item.title, titleMatch)}
                        </div>
                        {result.item.subtitle && (
                          <div className="global-search-result-subtitle">
                            {renderHighlightedText(result.item.subtitle, subtitleMatch)}
                          </div>
                        )}
                        <div className="global-search-result-route">{result.item.route}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
