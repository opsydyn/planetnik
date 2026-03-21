export type SearchDocumentKind = "page" | "file" | "unit" | "contributor" | "metric" | "extension" | "repository" | "team"

export interface SearchDocument {
  id: string
  kind: SearchDocumentKind
  title: string
  subtitle?: string
  description?: string
  keywords: string[]
  route: string
  section: string
  rank: number
}

export interface SearchIndexPayload {
  version: 1
  generatedAt: string
  documents: SearchDocument[]
}
