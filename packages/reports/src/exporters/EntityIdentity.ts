export const ENTITY_ID_POLICY = {
  repository: "repo:<normalised repository key>",
  file: "file:<normalised relative path>",
  unit: "unit:<normalised relative path>:<start line>",
  component: "component:<decomposition key>:<component name>",
  contributor: "contributor:<lowercase trimmed email>",
} as const

function normalisePath(value: string): string {
  return value
    .trim()
    .replaceAll("\\", "/")
    .replace(/^\.\/+/, "")
    .replace(/\/+/g, "/")
}

export function repositoryEntityId(repositoryKey: string): string {
  return `repo:${normalisePath(repositoryKey) || "repository"}`
}

export function fileEntityId(relativePath: string): string {
  return `file:${normalisePath(relativePath)}`
}

export function unitEntityId(relativePath: string, startLine: number): string {
  return `unit:${normalisePath(relativePath)}:${startLine}`
}

export function componentEntityId(decompositionKey: string, name: string): string {
  return `component:${normalisePath(decompositionKey)}:${name.trim()}`
}

export function contributorEntityId(email: string): string {
  return `contributor:${email.trim().toLowerCase()}`
}
