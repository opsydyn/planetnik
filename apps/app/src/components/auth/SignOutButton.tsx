import { useState, type ButtonHTMLAttributes } from "react"
import { authClient } from "../../lib/auth-client.js"

type SignOutButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick"> & {
  readonly redirectTo?: string
  readonly fallbackHref?: string
  readonly idleLabel?: string
  readonly pendingLabel?: string
}

export default function SignOutButton({
  redirectTo = "/sign-in",
  fallbackHref = "/sign-out",
  idleLabel = "Sign out",
  pendingLabel = "Signing out...",
  disabled,
  children,
  ...props
}: SignOutButtonProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClick = async () => {
    if (disabled || isSubmitting) {
      return
    }

    setIsSubmitting(true)

    try {
      await authClient.signOut()
      window.location.href = redirectTo
    } catch {
      window.location.href = fallbackHref
    }
  }

  return (
    <button {...props} type="button" disabled={disabled || isSubmitting} onClick={handleClick}>
      {children ?? (isSubmitting ? pendingLabel : idleLabel)}
    </button>
  )
}