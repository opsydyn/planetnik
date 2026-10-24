import { icons as deviconIcons } from "@iconify-json/devicon"

const fallbackTechnologyIconName = "devicon:devicon"

export interface TechnologyIconData {
  body: string
  width: number
  height: number
}

const technologyIconNamesByExtension = {
  astro: "devicon:astro",
  bash: "devicon:bash",
  c: "devicon:c",
  cjs: "devicon:javascript",
  cpp: "devicon:cplusplus",
  cs: "devicon:csharp",
  css: "devicon:css3",
  dockerfile: "devicon:docker",
  go: "devicon:go",
  htm: "devicon:html5",
  html: "devicon:html5",
  java: "devicon:java",
  js: "devicon:javascript",
  json: "devicon:json",
  jsx: "devicon:javascript",
  kt: "devicon:kotlin",
  kts: "devicon:kotlin",
  md: "devicon:markdown",
  mjs: "devicon:javascript",
  mts: "devicon:typescript",
  php: "devicon:php",
  py: "devicon:python",
  rb: "devicon:ruby",
  rs: "devicon:rust",
  scala: "devicon:scala",
  sh: "devicon:bash",
  swift: "devicon:swift",
  toml: "devicon:devicon",
  ts: "devicon:typescript",
  tsx: "devicon:typescript",
  vue: "devicon:vuejs",
  xml: "devicon:xml",
  yaml: "devicon:yaml",
  yml: "devicon:yaml",
} as const

function normalizeFileExtension(extension: string): string {
  return extension.trim().replace(/^\./, "").toLowerCase()
}

export function getTechnologyIconName(extension: string): string {
  const normalizedExtension = normalizeFileExtension(extension)
  return (
    technologyIconNamesByExtension[normalizedExtension as keyof typeof technologyIconNamesByExtension] ??
    fallbackTechnologyIconName
  )
}

export function getTechnologyIconData(extension: string): TechnologyIconData | null {
  const iconName = getTechnologyIconName(extension)
  const iconKey = iconName.startsWith("devicon:") ? iconName.slice("devicon:".length) : "devicon"
  const icon = deviconIcons.icons[iconKey]

  if (!icon) {
    return null
  }

  return {
    body: icon.body,
    width: icon.width ?? deviconIcons.width ?? 16,
    height: icon.height ?? deviconIcons.height ?? 16,
  }
}
