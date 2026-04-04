import { useAtom } from "@effect-atom/atom-react"
import { SystemIcon } from "@planetnik/report-ui/icons/SystemIcon.react"
import { useEffect } from "react"
import { publicVideoPausedAtom } from "../../lib/public-video-preferences.js"

const PLAYER_ID = "public-video-player"
const AUDIO_ID = "public-audio-player"

export default function PublicVideoToggle() {
  const [isPaused, setIsPaused] = useAtom(publicVideoPausedAtom)

  useEffect(() => {
    const video = document.getElementById(PLAYER_ID)
    const audio = document.getElementById(AUDIO_ID)
    if (!(video instanceof HTMLVideoElement)) {
      return
    }

    if (isPaused) {
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
  }, [isPaused])

  const handleToggle = () => {
    setIsPaused((value) => !value)
  }

  return (
    <div className="auth-video-toggle-row">
      <button
        type="button"
        className="button-secondary auth-video-toggle"
        onClick={handleToggle}
        aria-pressed={isPaused}
        aria-label={isPaused ? "Play background media" : "Pause background media"}
      >
        <SystemIcon name={isPaused ? "play" : "pause"} size={16} />
        <span>{isPaused ? "Play media" : "Pause media"}</span>
      </button>
    </div>
  )
}
