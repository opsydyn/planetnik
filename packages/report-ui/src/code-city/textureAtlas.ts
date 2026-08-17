import { CanvasTexture, SRGBColorSpace } from "three"
import type { CodeCityTexturePattern } from "./visualTokens.js"

export type CodeCityTextureAtlas = {
  readonly get: (pattern: CodeCityTexturePattern) => CanvasTexture
  readonly dispose: () => void
}

const patterns: readonly CodeCityTexturePattern[] = ["solid", "banded", "checker", "gridded"]
const atlasSize = 32

const drawPattern = (context: CanvasRenderingContext2D, pattern: CodeCityTexturePattern): void => {
  context.fillStyle = "#ffffff"
  context.fillRect(0, 0, atlasSize, atlasSize)
  context.fillStyle = "#aeb8c5"

  switch (pattern) {
    case "solid":
      return
    case "banded":
      for (let y = 0; y < atlasSize; y += 8) context.fillRect(0, y, atlasSize, 4)
      return
    case "checker":
      for (let y = 0; y < atlasSize; y += 8) {
        for (let x = (y / 8) % 2 === 0 ? 0 : 8; x < atlasSize; x += 16) {
          context.fillRect(x, y, 8, 8)
        }
      }
      return
    case "gridded":
      for (let position = 0; position < atlasSize; position += 8) {
        context.fillRect(position, 0, 1, atlasSize)
        context.fillRect(0, position, atlasSize, 1)
      }
  }
}

export function createCodeCityTextureAtlas(documentRef: Document): CodeCityTextureAtlas | null {
  const textures = new Map<CodeCityTexturePattern, CanvasTexture>()

  for (const pattern of patterns) {
    const canvas = documentRef.createElement("canvas")
    canvas.width = atlasSize
    canvas.height = atlasSize
    const context = canvas.getContext("2d")
    if (context === null) {
      textures.forEach((texture) => texture.dispose())
      return null
    }

    drawPattern(context, pattern)
    const texture = new CanvasTexture(canvas)
    texture.colorSpace = SRGBColorSpace
    texture.needsUpdate = true
    textures.set(pattern, texture)
  }

  let disposed = false

  return {
    get: (pattern) => {
      const texture = textures.get(pattern)
      if (texture === undefined) throw new Error(`Unknown Code City texture pattern: ${pattern}`)
      return texture
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      textures.forEach((texture) => texture.dispose())
    },
  }
}
