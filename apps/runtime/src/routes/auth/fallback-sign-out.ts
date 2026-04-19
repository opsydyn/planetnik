type SignOutSessionLike =
  | {
      readonly session?: {
        readonly token?: string | null
      } | null
    }
  | null
  | undefined

export type SignOutFallbackCleanupDependencies = {
  readonly getSession: (input: { readonly headers: Headers }) => Promise<SignOutSessionLike>
  readonly deleteSessionByToken: (token: string) => Promise<void>
  readonly logError?: (message: string, error: unknown) => void
}

export async function cleanupFallbackSignOutSession(
  request: Request,
  dependencies: SignOutFallbackCleanupDependencies,
): Promise<boolean> {
  try {
    const session = await dependencies.getSession({
      headers: request.headers,
    })
    const token = session?.session?.token

    if (!token) {
      return false
    }

    await dependencies.deleteSessionByToken(token)
    return true
  } catch (error) {
    dependencies.logError?.("Auth sign-out fallback could not delete session from database", error)
    return false
  }
}
