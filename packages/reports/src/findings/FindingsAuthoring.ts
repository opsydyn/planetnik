export interface FindingsAuthoringItem {
  readonly id: string
  readonly summary: string
  readonly body: string
}

export interface FindingsAuthoringDocument {
  readonly title?: string
  readonly items: readonly FindingsAuthoringItem[]
}

export interface FindingsExportItem {
  readonly id: string
  readonly summary: string
  readonly bodyMarkdown?: string
  readonly bodyHtml: string
  readonly bodyText: string
}

export interface NormalizedFindingsDocument {
  readonly title: string
  readonly items: readonly FindingsExportItem[]
}

export class FindingsAuthoringError extends Error {
  readonly sourcePath: string

  constructor(sourcePath: string, message: string) {
    super(`Invalid findings document at ${sourcePath}: ${message}`)
    this.name = "FindingsAuthoringError"
    this.sourcePath = sourcePath
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requiredString(value: unknown, field: string, index: number, sourcePath: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new FindingsAuthoringError(sourcePath, `item ${index + 1} requires a non-empty ${field}`)
  }
  return value.trim()
}

export function parseFindingsAuthoringDocument(raw: unknown, sourcePath = "findings.json"): FindingsAuthoringDocument {
  if (!isRecord(raw)) {
    throw new FindingsAuthoringError(sourcePath, "the document must be an object")
  }

  const rawItems = raw.items
  if (!Array.isArray(rawItems)) {
    throw new FindingsAuthoringError(sourcePath, "items must be an array")
  }

  const title =
    raw.title === undefined
      ? undefined
      : typeof raw.title === "string"
        ? raw.title.trim() || undefined
        : (() => {
            throw new FindingsAuthoringError(sourcePath, "title must be a non-empty string when provided")
          })()
  const ids = new Set<string>()
  const items: FindingsAuthoringItem[] = []

  for (let index = 0; index < rawItems.length; index += 1) {
    const rawItem = rawItems[index]
    if (!isRecord(rawItem)) {
      throw new FindingsAuthoringError(sourcePath, `item ${index + 1} must be an object`)
    }

    const id = requiredString(rawItem.id, "id", index, sourcePath)
    if (ids.has(id)) {
      throw new FindingsAuthoringError(sourcePath, `duplicate finding id "${id}"`)
    }
    ids.add(id)

    const summary = requiredString(rawItem.summary, "summary", index, sourcePath)
    if (typeof rawItem.body !== "string") {
      throw new FindingsAuthoringError(sourcePath, `item ${index + 1} requires a string body`)
    }

    items.push({ id, summary, body: rawItem.body })
  }

  return { ...(title ? { title } : {}), items }
}

export function escapeFindingsHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function renderInlineMarkdown(value: string): string {
  let rendered = escapeFindingsHtml(value)
  // Inline code is replaced first so its contents cannot be interpreted as markup.
  rendered = rendered.replace(/`([^`]+)`/g, "<code>$1</code>")
  rendered = rendered.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
  rendered = rendered.replace(/__(.+?)__/g, "<strong>$1</strong>")
  rendered = rendered.replace(/\*([^*\n]+)\*/g, "<em>$1</em>")
  rendered = rendered.replace(/_([^_\n]+)_/g, "<em>$1</em>")
  rendered = rendered.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>')
  return rendered
}

export function renderFindingsMarkdownToHtml(markdown: string): string {
  const normalized = markdown.replace(/\r\n?/g, "\n").trim()
  if (!normalized) return ""

  return normalized
    .split(/\n\s*\n/)
    .map((block) => {
      const lines = block.split("\n")
      const fence = lines[0]?.match(/^\s*```(?:[\w-]+)?\s*$/)
      if (fence && lines.at(-1)?.trim() === "```") {
        return `<pre><code>${escapeFindingsHtml(lines.slice(1, -1).join("\n"))}</code></pre>`
      }

      const heading = lines.length === 1 ? lines[0]?.match(/^(#{1,6})\s+(.+)$/) : null
      if (heading) {
        return `<h${heading[1]!.length}>${renderInlineMarkdown(heading[2]!)}</h${heading[1]!.length}>`
      }

      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        const listItems = lines
          .map((line) => line.replace(/^\s*[-*]\s+/, ""))
          .map((line) => `<li>${renderInlineMarkdown(line)}</li>`)
          .join("")
        return `<ul>${listItems}</ul>`
      }

      return `<p>${lines.map((line) => renderInlineMarkdown(line.trim())).join("<br />")}</p>`
    })
    .join("")
}

export function findingsMarkdownToText(markdown: string): string {
  return markdown
    .replace(/```(?:[\w-]+)?/g, "")
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[*_]{1,2}/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

export function normalizeFindingsAuthoringDocument(document: FindingsAuthoringDocument): NormalizedFindingsDocument {
  return {
    title: document.title?.trim() || "Notes & Findings",
    items: document.items.map((item) => ({
      id: item.id,
      summary: item.summary,
      bodyMarkdown: item.body,
      bodyHtml: renderFindingsMarkdownToHtml(item.body),
      bodyText: findingsMarkdownToText(item.body),
    })),
  }
}
