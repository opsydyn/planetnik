import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause"
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play"
import { useEffect, useState } from "react"

const STORAGE_KEY = "planetnik.publicVideoPaused"
const PLAYER_ID = "public-video-player"
const AUDIO_ID = "public-audio-player"

export default function PublicVideoToggle() {
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "true") setIsPaused(true)
  }, [])

  useEffect(() => {
    const video = document.getElementById(PLAYER_ID)
    const audio = document.getElementById(AUDIO_ID)
    if (!(video instanceof HTMLVideoElement)) return

    if (isPaused) {
      video.pause()
      if (audio instanceof HTMLAudioElement) audio.pause()
    } else {
      void video.play().catch(() => {})
      if (audio instanceof HTMLAudioElement) void audio.play().catch(() => {})
    }
    localStorage.setItem(STORAGE_KEY, String(isPaused))
  }, [isPaused])

  return (
    <button
      type="button"
      className="coming-soon-video-toggle"
      onClick={() => setIsPaused((p) => !p)}
      aria-pressed={isPaused}
      aria-label={isPaused ? "Play background media" : "Pause background media"}
    >
      {isPaused ? <PlayIcon size={15} weight="bold" /> : <PauseIcon size={15} weight="bold" />}
      <span>{isPaused ? "Play" : "Pause"}</span>
    </button>
  )
}
