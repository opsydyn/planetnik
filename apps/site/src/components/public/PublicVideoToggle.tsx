import { useAtom } from "@effect-atom/atom-react"
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause"
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play"
import { useEffect } from "react"
import { publicVideoPausedAtom } from "../../lib/public-video-preferences.js"

const PLAYER_ID = "public-video-player"
const AUDIO_ID = "public-audio-player"

function syncMediaElements(paused: boolean) {
  const video = document.getElementById(PLAYER_ID)
  const audio = document.getElementById(AUDIO_ID)

  if (!(video instanceof HTMLVideoElement)) {
    return
  }

  if (paused) {
    video.pause()
    if (audio instanceof HTMLAudioElement) {
      audio.pause()
    }
    return
  }

  void video.play().catch(() => {})
  if (audio instanceof HTMLAudioElement) {
    void audio.play().catch(() => {})
  }
}

export default function PublicVideoToggle() {
  const [isPaused, setIsPaused] = useAtom(publicVideoPausedAtom)

  useEffect(() => {
    syncMediaElements(isPaused)
    document.dispatchEvent(new CustomEvent("planetnik:video-paused-change", { detail: { paused: isPaused } }))
  }, [isPaused])

  useEffect(() => {
    const onExternalChange = (e: Event) => {
      const event = e as CustomEvent<{ paused: boolean }>
      setIsPaused(event.detail.paused)
    }
    document.addEventListener("planetnik:video-paused-change", onExternalChange)
    return () => document.removeEventListener("planetnik:video-paused-change", onExternalChange)
  }, [setIsPaused])

  return (
    <button
      type="button"
      className="coming-soon-video-toggle"
      onClick={() => {
        const nextPaused = !isPaused
        syncMediaElements(nextPaused)
        setIsPaused(nextPaused)
      }}
      aria-pressed={isPaused}
      aria-label={isPaused ? "Play background media" : "Pause background media"}
    >
      {isPaused ? <PlayIcon size={15} weight="bold" /> : <PauseIcon size={15} weight="bold" />}
      <span>{isPaused ? "Play" : "Pause"}</span>
    </button>
  )
}
