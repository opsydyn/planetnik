const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"])

export function isHostedIntelligenceEnabled(): boolean {
  const raw = import.meta.env.SHOW_INTELLIGENCE

  if (typeof raw === "boolean") {
    return raw
  }

  if (typeof raw === "string") {
    return TRUTHY_VALUES.has(raw.trim().toLowerCase())
  }

  return false
}
