import { getRuntimeAuthSession, type RuntimeAuthSession, type RuntimeAuthUser } from "./runtime-client.js"

export type AuthUser = RuntimeAuthUser
export type AuthSession = RuntimeAuthSession

export async function resolveSession(
  request: Request,
): Promise<{ user: AuthUser | null; session: AuthSession | null }> {
  return getRuntimeAuthSession(request.headers.get("cookie"))
}
