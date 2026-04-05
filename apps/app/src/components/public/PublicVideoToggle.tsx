import { useAtom } from "@effect-atom/atom-react"
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause"
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play"
import { useEffect } from "react"
import { publicVideoPausedAtom } from "../../lib/public-video-preferences.js"

const PLAYER_ID = "public-video-player"
const AUDIO_ID = "public-audio-player"

export default function PublicVideoToggle() {
  const [isPaused, setIsPaused] = useAtom(publicVideoPausedAtom)

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
