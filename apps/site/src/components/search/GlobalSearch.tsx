import Fuse, { type FuseResultMatch } from "fuse.js"
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass"
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap"
import { XIcon } from "@phosphor-icons/react/dist/csr/X"
import {
  startTransition,
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
} from "react"
import { fuseOptions } from "../../lib/search/fuseConfig"
import type { SearchDocument, SearchDocumentKind, SearchIndexPayload } from "../../lib/search/types"
import "./GlobalSearch.css"

type SearchResult = {
  item: SearchDocument
  matches?: readonly FuseResultMatch[]
}

let searchDocumentsCache: SearchDocument[] | null = null
let searchFuseCache: Fuse<SearchDocument> | null = null
let searchLoadPromise: Promise<{ documents: SearchDocument[]; fuse: Fuse<SearchDocument> }> | null = null

const kindLabels: Record<SearchDocumentKind, string> = {
  page: "Pages",
  file: "Files",
  unit: "Units",
  contributor: "People",
  metric: "Metrics",
  extension: "Languages",
}

function getDefaultResults(documents: SearchDocument[]): SearchResult[] {
  return documents.slice(0, 12).map((item) => ({ item }))
}

function groupResults(results: SearchResult[]): Array<{ label: string; items: Array<SearchResult & { index: number }> }> {
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

  match.indices.forEach(([start, end], index) => {
    if (cursor < start) {
      parts.push(<span key={`text-${index}-${cursor}`}>{text.slice(cursor, start)}</span>)
    }
    parts.push(
      <mark key={`mark-${index}-${start}`} className="global-search-highlight">
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

async function loadSearchIndex() {
  if (searchDocumentsCache && searchFuseCache) {
    return { documents: searchDocumentsCache, fuse: searchFuseCache }
  }

  if (!searchLoadPromise) {
    searchLoadPromise = (async () => {
      const response = await fetch("/search-index.json")
      if (!response.ok) {
        throw new Error(`Search index request failed with ${response.status}`)
      }

      const payload = (await response.json()) as SearchIndexPayload
      searchDocumentsCache = payload.documents
      searchFuseCache = new Fuse(payload.documents, fuseOptions)
      return { documents: searchDocumentsCache, fuse: searchFuseCache }
    })().catch((error) => {
      searchLoadPromise = null
      throw error
    })
  }

  return searchLoadPromise
}

export default function GlobalSearch({ projectName }: { projectName: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [results, setResults] = useState<SearchResult[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([])
  const documentsRef = useRef<SearchDocument[]>([])
  const fuseRef = useRef<Fuse<SearchDocument> | null>(null)
  const deferredQuery = useDeferredValue(query.trim())
  const dialogTitleId = useId()

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setIsOpen(true)
        return
      }

      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  useEffect(() => {
    if (!isOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.setTimeout(() => inputRef.current?.focus(), 0)

    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSearchIndex()
        .then(({ documents, fuse }) => {
          documentsRef.current = documents
          fuseRef.current = fuse
        })
        .catch(() => {})
    }, 1500)

    return () => window.clearTimeout(timeoutId)
  }, [])

  useEffect(() => {
    if (!isOpen || fuseRef.current || isLoading) return

    let cancelled = false

    async function hydrateSearchIndex() {
      setIsLoading(true)
      setError(null)

      try {
        const { documents, fuse } = await loadSearchIndex()
        if (cancelled) return

        documentsRef.current = documents
        fuseRef.current = fuse
        setResults(getDefaultResults(documents))
      } catch (loadError) {
        if (cancelled) return
        setError(loadError instanceof Error ? loadError.message : "Unable to load search index.")
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void hydrateSearchIndex()

    return () => {
      cancelled = true
    }
  }, [isLoading, isOpen])

  useEffect(() => {
    if (!isOpen || !fuseRef.current) return

    startTransition(() => {
      if (!deferredQuery) {
        setResults(getDefaultResults(documentsRef.current))
        setActiveIndex(0)
        return
      }

      const nextResults = fuseRef.current
        ?.search(deferredQuery, { limit: 24 })
        .map((result) => ({ item: result.item, matches: result.matches }))

      setResults(nextResults ?? [])
      setActiveIndex(0)
    })
  }, [deferredQuery, isOpen])

  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= results.length) return
    resultRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" })
  }, [activeIndex, results])

  function closeSearch() {
    setIsOpen(false)
    setQuery("")
    setActiveIndex(0)
  }

  function openResult(result: SearchResult | undefined) {
    if (!result) return
    closeSearch()
    window.location.assign(result.item.route)
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault()
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)))
      return
    }

    if (event.key === "ArrowUp") {
      event.preventDefault()
      setActiveIndex((current) => Math.max(current - 1, 0))
      return
    }

    if (event.key === "Enter") {
      event.preventDefault()
      openResult(results[activeIndex])
    }
  }

  const groupedResults = groupResults(results)
  const shortcutLabel = typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac") ? "⌘K" : "Ctrl K"

  return (
    <div className="global-search-root">
      <button
        type="button"
        className="global-search-trigger"
        onClick={() => setIsOpen(true)}
        onMouseEnter={() => {
          void loadSearchIndex()
            .then(({ documents, fuse }) => {
              documentsRef.current = documents
              fuseRef.current = fuse
            })
            .catch(() => {})
        }}
        onFocus={() => {
          void loadSearchIndex()
            .then(({ documents, fuse }) => {
              documentsRef.current = documents
              fuseRef.current = fuse
            })
            .catch(() => {})
        }}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={dialogTitleId}
      >
        <MagnifyingGlassIcon size={16} />
        <span className="global-search-trigger-label">Search</span>
        <span className="global-search-trigger-shortcut">{shortcutLabel}</span>
      </button>

      {isOpen && (
        <>
          <div className="global-search-overlay" onClick={closeSearch} />
          <div className="global-search-dialog" role="dialog" aria-modal="true" aria-labelledby={dialogTitleId}>
            <div className="global-search-header">
              <div className="global-search-input-wrap">
                {isLoading ? (
                  <SpinnerGapIcon size={18} className="global-search-spinner" />
                ) : (
                  <MagnifyingGlassIcon size={18} />
                )}
                <input
                  ref={inputRef}
                  className="global-search-input"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  placeholder={`Search ${projectName} reports, files, units, and metrics`}
                />
              </div>
              <button type="button" className="global-search-close" onClick={closeSearch} aria-label="Close search">
                <XIcon size={16} />
              </button>
            </div>

            <div className="global-search-meta" id={dialogTitleId}>
              Site search across pages, files, units, people, metrics, and language summaries.
            </div>

            <div className="global-search-results">
              {error ? (
                <div className="global-search-error">{error}</div>
              ) : isLoading && results.length === 0 ? (
                <div className="global-search-loading">Loading search index…</div>
              ) : groupedResults.length === 0 ? (
                <div className="global-search-empty">No matches for “{query}”.</div>
              ) : (
                groupedResults.map((group) => (
                  <section key={group.label} className="global-search-group">
                    <div className="global-search-group-label">{group.label}</div>
                    {group.items.map((result) => (
                      <button
                        key={result.item.id}
                        ref={(element) => {
                          resultRefs.current[result.index] = element
                        }}
                        type="button"
                        className="global-search-result"
                        data-active={result.index === activeIndex}
                        onMouseEnter={() => setActiveIndex(result.index)}
                        onClick={() => openResult(result)}
                      >
                        <div className="global-search-result-main">
                          <div className="global-search-result-title">
                            {renderHighlightedText(result.item.title, getFieldMatch(result.matches, "title"))}
                          </div>
                          {result.item.subtitle && (
                            <div className="global-search-result-subtitle">
                              {renderHighlightedText(result.item.subtitle, getFieldMatch(result.matches, "subtitle"))}
                            </div>
                          )}
                          <div className="global-search-result-route">{result.item.route}</div>
                        </div>
                      </button>
                    ))}
                  </section>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
