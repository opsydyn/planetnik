import { navigate } from "astro:transitions/client"
import { MagnifyingGlassIcon } from "@phosphor-icons/react/dist/csr/MagnifyingGlass"
import { SpinnerGapIcon } from "@phosphor-icons/react/dist/csr/SpinnerGap"
import { XIcon } from "@phosphor-icons/react/dist/csr/X"
import Fuse, { type FuseResultMatch } from "fuse.js"
import {
	startTransition,
	useDeferredValue,
	useEffect,
	useId,
	useRef,
	useState,
} from "react"
import { fuseOptions } from "../../lib/search/fuseConfig"
import type {
	SearchDocument,
	SearchDocumentKind,
	SearchIndexPayload,
} from "../../lib/search/types"
import "./GlobalSearch.css"

type SearchResult = {
	item: SearchDocument
	matches?: readonly FuseResultMatch[]
}

let searchDocumentsCache: SearchDocument[] | null = null
let searchFuseCache: Fuse<SearchDocument> | null = null
let searchLoadPromise: Promise<{
	documents: SearchDocument[]
	fuse: Fuse<SearchDocument>
}> | null = null

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

function getFieldMatch(
	matches: readonly FuseResultMatch[] | undefined,
	key: "title" | "subtitle",
) {
	return matches?.find((match) => match.key === key && typeof match.value === "string")
}

function renderHighlightedText(
	text: string | undefined,
	match: FuseResultMatch | undefined,
) {
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

export default function GlobalSearch({
	projectName,
	searchIndexUrl,
}: {
	projectName: string
	searchIndexUrl: string
}) {
	const [isOpen, setIsOpen] = useState(false)
	const [query, setQuery] = useState("")
	const [isLoading, setIsLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [results, setResults] = useState<SearchResult[]>([])
	const [activeIndex, setActiveIndex] = useState(0)
	const [shortcutLabel, setShortcutLabel] = useState("Ctrl K")
	const inputRef = useRef<HTMLInputElement | null>(null)
	const resultRefs = useRef<Array<HTMLButtonElement | null>>([])
	const documentsRef = useRef<SearchDocument[]>([])
	const fuseRef = useRef<Fuse<SearchDocument> | null>(null)
	const deferredQuery = useDeferredValue(query.trim())
	const dialogTitleId = useId()

	useEffect(() => {
		setShortcutLabel(/mac|iphone|ipad|ipod/i.test(navigator.userAgent) ? "⌘K" : "Ctrl K")
	}, [])

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

	async function loadIndex() {
		if (searchDocumentsCache && searchFuseCache) {
			return { documents: searchDocumentsCache, fuse: searchFuseCache }
		}
		if (!searchLoadPromise) {
			searchLoadPromise = (async () => {
				const response = await fetch(searchIndexUrl)
				if (!response.ok) {
					throw new Error(`Search index request failed with ${response.status}`)
				}
				const payload = (await response.json()) as SearchIndexPayload
				searchDocumentsCache = payload.documents
				searchFuseCache = new Fuse(payload.documents, fuseOptions)
				return { documents: searchDocumentsCache, fuse: searchFuseCache }
			})().catch((err) => {
				searchLoadPromise = null
				throw err
			})
		}
		return searchLoadPromise
	}

	useEffect(() => {
		if (!isOpen) return
		setIsLoading(true)
		setError(null)

		loadIndex()
			.then(({ documents, fuse }) => {
				documentsRef.current = documents
				fuseRef.current = fuse
				setResults(getDefaultResults(documents))
				setIsLoading(false)
			})
			.catch((err) => {
				setError(err instanceof Error ? err.message : "Failed to load search index")
				setIsLoading(false)
			})
	}, [isOpen])

	useEffect(() => {
		if (!fuseRef.current || !documentsRef.current.length) return

		startTransition(() => {
			if (!deferredQuery) {
				setResults(getDefaultResults(documentsRef.current))
				setActiveIndex(0)
				return
			}
			const fuseResults = fuseRef.current!.search(deferredQuery)
			setResults(fuseResults.map((r) => ({ item: r.item, matches: r.matches })))
			setActiveIndex(0)
		})
	}, [deferredQuery])

	function handleResultClick(result: SearchResult) {
		navigate(result.item.route)
		setIsOpen(false)
	}

	function handleKeyDown(event: React.KeyboardEvent) {
		const flat = results
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
			const active = flat[activeIndex]
			if (active) handleResultClick(active)
		}
	}

	const grouped = groupResults(results)

	if (!isOpen) {
		return (
			<button
				type="button"
				className="global-search-trigger"
				onClick={() => setIsOpen(true)}
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
			<div
				className="global-search-overlay"
				role="presentation"
				onClick={() => setIsOpen(false)}
			/>
			<div
				className="global-search-dialog"
				role="dialog"
				aria-modal="true"
				aria-labelledby={dialogTitleId}
				onKeyDown={handleKeyDown}
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
