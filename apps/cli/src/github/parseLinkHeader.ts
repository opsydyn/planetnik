export interface LinkHeaderRels {
  next?: string
  prev?: string
  first?: string
  last?: string
}

const VALID_RELS = new Set(["next", "prev", "first", "last"])

/**
 * Parse a GitHub-style `Link` response header into its rel→URL components.
 *
 * Supports cursor-based pagination (Dependabot alerts) and offset pagination (org repos).
 * Malformed segments are silently skipped.
 */
export function parseLinkHeader(header: string | null | undefined): LinkHeaderRels {
  if (!header) return {}

  const result: LinkHeaderRels = {}

  for (const match of header.matchAll(/<([^>]+)>\s*;\s*rel="([^"]+)"/g)) {
    const [, url, rel] = match
    if (rel && VALID_RELS.has(rel)) {
      result[rel as keyof LinkHeaderRels] = url!
    }
  }

  return result
}
