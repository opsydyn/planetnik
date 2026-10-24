import { describe, expect, test } from "bun:test"
import { AtomRegistry as Registry } from "effect/reactivity"
import { PUBLIC_VIDEO_PAUSED_KEY, publicVideoPausedAtom } from "./public-video-preferences.js"

class MemoryStorage implements Storage {
  #store = new Map<string, string>()

  get length() {
    return this.#store.size
  }

  clear() {
    this.#store.clear()
  }

  getItem(key: string) {
    return this.#store.get(key) ?? null
  }

  key(index: number) {
    return [...this.#store.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.#store.delete(key)
  }

  setItem(key: string, value: string) {
    this.#store.set(key, value)
  }
}

const storage = new MemoryStorage()

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
})

describe("public video preferences", () => {
  test("defaults to paused and persists play state in localStorage", async () => {
    storage.clear()

    const firstRegistry = Registry.make()
    expect(firstRegistry.get(publicVideoPausedAtom)).toBe(true)

    firstRegistry.set(publicVideoPausedAtom, false)
    expect(storage.getItem(PUBLIC_VIDEO_PAUSED_KEY)).toBe("false")

    const secondRegistry = Registry.make()
    expect(secondRegistry.get(publicVideoPausedAtom)).toBe(false)
  })
})
