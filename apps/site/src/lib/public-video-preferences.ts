import { BrowserKeyValueStore } from "@effect/platform-browser"
import { Schema } from "effect"
import { Atom } from "effect/reactivity"

export const PUBLIC_VIDEO_PAUSED_KEY = "planetnik.publicVideoPaused"

const localStorageRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)
const defaultPausedValue = () => true

export const publicVideoPausedAtom = Atom.withServerValue(
  Atom.kvs({
    runtime: localStorageRuntime,
    key: PUBLIC_VIDEO_PAUSED_KEY,
    schema: Schema.Boolean,
    defaultValue: defaultPausedValue,
  }),
  defaultPausedValue,
)
