export interface ContributorIdentity {
  email: string
  userName?: string | null
}

export function getContributorDisplayName({ email, userName }: ContributorIdentity): string {
  const trimmedUserName = userName?.trim()
  if (trimmedUserName) return trimmedUserName

  const atIndex = email.indexOf("@")
  return atIndex > 0 ? email.slice(0, atIndex) : email
}

export function getContributorRouteParam(email: string): string {
  return encodeURIComponent(email).replace(/%/g, "$")
}
