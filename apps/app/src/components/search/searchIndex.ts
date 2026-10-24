import Fuse from "fuse.js"
import { fuseOptions } from "../../lib/search/fuseConfig.js"
import type { SearchDocument, SearchIndexPayload } from "../../lib/search/types.js"

export type LoadedSearchIndex = {
  documents: SearchDocument[]
  fuse: Fuse<SearchDocument>
}

const searchLoads = new Map<string, Promise<LoadedSearchIndex>>()

export function loadSearchIndex(searchIndexUrl: string): Promise<LoadedSearchIndex> {
  let searchLoadPromise = searchLoads.get(searchIndexUrl)
  if (!searchLoadPromise) {
    searchLoadPromise = (async () => {
      const response = await fetch(searchIndexUrl)
      if (!response.ok) {
        throw new Error(`Search index request failed with ${response.status}`)
      }
      const payload = (await response.json()) as SearchIndexPayload
      return { documents: payload.documents, fuse: new Fuse(payload.documents, fuseOptions) }
    })().catch((error) => {
      searchLoads.delete(searchIndexUrl)
      throw error
    })
    searchLoads.set(searchIndexUrl, searchLoadPromise)
  }
  return searchLoadPromise
}
