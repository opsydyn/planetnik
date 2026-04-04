import { Atom } from "@effect-atom/atom-react"
import { BrowserKeyValueStore } from "@effect/platform-browser"
import { Schema } from "effect"

export const PUBLIC_VIDEO_PAUSED_KEY = "planetnik.publicVideoPaused"

const localStorageRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)

export const publicVideoPausedAtom = Atom.withServerValue(
  Atom.kvs({
    runtime: localStorageRuntime,
    key: PUBLIC_VIDEO_PAUSED_KEY,
    schema: Schema.Boolean,
    defaultValue: () => false,
  }),
  () => false,
)
