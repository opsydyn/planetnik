const TRUTHY_VALUES = new Set(["1", "true", "yes", "on"])

function readHostedIntelligenceFlag(): string | boolean | undefined {
  if (typeof process !== "undefined") {
    const runtimeValue = process.env.SHOW_INTELLIGENCE

    if (typeof runtimeValue === "string") {
      return runtimeValue
    }
  }

  return import.meta.env.SHOW_INTELLIGENCE
}

export function isHostedIntelligenceEnabled(): boolean {
  const raw = readHostedIntelligenceFlag()

  if (typeof raw === "boolean") {
    return raw
  }

  if (typeof raw === "string") {
    return TRUTHY_VALUES.has(raw.trim().toLowerCase())
  }

  return false
}
