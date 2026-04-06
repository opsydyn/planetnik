import { useAtom } from "@effect-atom/atom-react"
import { SystemIcon } from "@planetnik/report-ui/icons/SystemIcon.react"
import { useEffect } from "react"
import { publicVideoPausedAtom } from "../../lib/public-video-preferences.js"

const PLAYER_ID = "public-video-player"
const AUDIO_ID = "public-audio-player"

export default function PublicVideoToggle() {
  const [isPaused, setIsPaused] = useAtom(publicVideoPausedAtom)

  useEffect(() => {
    document.dispatchEvent(
      new CustomEvent("planetnik:video-paused-change", { detail: { paused: isPaused } }),
    )
  }, [isPaused])

  // Keep atom in sync when spacebar changes localStorage externally
  useEffect(() => {
    const onExternalChange = (e: Event) => {
      const event = e as CustomEvent<{ paused: boolean }>
      setIsPaused(event.detail.paused)
    }
    document.addEventListener("planetnik:video-paused-change", onExternalChange)
    return () => document.removeEventListener("planetnik:video-paused-change", onExternalChange)
  }, [setIsPaused])

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
