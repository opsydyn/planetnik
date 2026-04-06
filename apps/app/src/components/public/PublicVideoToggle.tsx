import { useAtom } from "@effect-atom/atom-react"
import { PauseIcon } from "@phosphor-icons/react/dist/csr/Pause"
import { PlayIcon } from "@phosphor-icons/react/dist/csr/Play"
import { useEffect } from "react"
import { publicVideoPausedAtom } from "../../lib/public-video-preferences.js"


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
