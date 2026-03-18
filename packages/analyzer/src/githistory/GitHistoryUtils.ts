import { CommitInfo } from "./CommitInfo.js"

export class FileUpdate {
  date: string
  email: string
  commitId: string
  path: string
  userName: string
  bot: boolean

  constructor(
    date: string,
    email: string,
    commitId: string,
    path: string,
    userName: string = "",
    bot: boolean = false,
  ) {
    this.date = date
    this.email = email
    this.commitId = commitId
    this.path = path
    this.userName = userName
    this.bot = bot
  }

  getExtension(): string {
    const name = this.path.replace(/\\/g, "/")
    const lastDot = name.lastIndexOf(".")
    if (lastDot < 0) return ""
    return name.substring(lastDot + 1).toLowerCase()
  }
}

export class AuthorCommit {
  commitId: string
  email: string
  date: string
  userName: string
  filesUpdated: number
  bot: boolean

  constructor(date: string = "", email: string = "", userName: string = "", bot: boolean = false) {
    this.commitId = ""
    this.date = date
    this.email = email
    this.userName = userName
    this.filesUpdated = 1
    this.bot = bot
  }

  getYear(): string {
    return this.date.length >= 4 ? this.date.substring(0, 4) : ""
  }

  getMonth(): string {
    return this.date.length >= 7 ? this.date.substring(0, 7) : ""
  }

  getWeekOfYear(): string {
    if (this.date.length < 10) return ""
    const parts = this.date.substring(0, 10).split("-")
    if (parts.length !== 3) return ""
    const yearPart = parts[0]
    const monthPart = parts[1]
    const dayPart = parts[2]
    if (!yearPart || !monthPart || !dayPart) return ""

    const year = Number.parseInt(yearPart, 10)
    const month = Number.parseInt(monthPart, 10) - 1
    const day = Number.parseInt(dayPart, 10)
    if (Number.isNaN(year) || Number.isNaN(month) || Number.isNaN(day)) return ""

    const d = new Date(year, month, day)
    // Roll back to Monday
    while (d.getDay() !== 1) {
      d.setDate(d.getDate() - 1)
    }
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const dd = String(d.getDate()).padStart(2, "0")
    return `${y}-${m}-${dd}`
  }
}

export class GitHistoryUtils {
  static readonly GIT_HISTORY_FILE_NAME = "git-history.txt"
  static readonly EARLIEST_DATE = "1980-01-01"

  static printContributorsCommand(): string {
    return 'git log --format="%ad %ae %H" --date=short --diff-filter=AMRD --name-only'
  }

  static parseLine(line: string, ignorePatterns: string[] = []): FileUpdate | null {
    if (!line || line.length < 12) return null

    const date = line.substring(0, 10)
    if (date < GitHistoryUtils.EARLIEST_DATE) return null

    const rest = line.substring(11)
    const firstSpace = rest.indexOf(" ")
    if (firstSpace < 0) return null

    const email = rest.substring(0, firstSpace)
    const afterEmail = rest.substring(firstSpace + 1)

    if (GitHistoryUtils.shouldIgnore(email, ignorePatterns)) return null

    // New format: "hash authorName\tpath" (tab separates header from path)
    const tabIdx = afterEmail.indexOf("\t")
    if (tabIdx >= 0) {
      // Hash is the first 40 hex chars (or until first space)
      const headerPart = afterEmail.substring(0, tabIdx)
      const spaceInHeader = headerPart.indexOf(" ")
      const commitId = spaceInHeader >= 0 ? headerPart.substring(0, spaceInHeader) : headerPart
      const userName = spaceInHeader >= 0 ? headerPart.substring(spaceInHeader + 1) : ""
      const path = afterEmail.substring(tabIdx + 1).replace(/&nbsp;/g, " ")
      return new FileUpdate(date, email, commitId, path, userName)
    }

    // Legacy format: "hash path" (space separated, no author name)
    const secondSpace = afterEmail.indexOf(" ")
    if (secondSpace < 0) return null

    const commitId = afterEmail.substring(0, secondSpace)
    const path = afterEmail.substring(secondSpace + 1).replace(/&nbsp;/g, " ")

    return new FileUpdate(date, email, commitId, path)
  }

  static shouldIgnore(email: string, ignorePatterns: string[]): boolean {
    for (const pattern of ignorePatterns) {
      try {
        if (new RegExp(pattern, "i").test(email)) return true
      } catch {
        if (email.toLowerCase().includes(pattern.toLowerCase())) return true
      }
    }
    return false
  }

  static isBot(email: string, botPatterns: string[]): boolean {
    return GitHistoryUtils.shouldIgnore(email, botPatterns)
  }

  static parseGitHistoryLines(lines: string[], ignorePatterns: string[] = []): FileUpdate[] {
    const updates: FileUpdate[] = []
    let currentCommit: { date: string; email: string; commitId: string; userName: string } | null = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        currentCommit = null
        continue
      }

      // If line starts with a date pattern (yyyy-mm-dd), it's a commit header
      if (/^\d{4}-\d{2}-\d{2} /.test(trimmed)) {
        const parsed = GitHistoryUtils.parseLine(trimmed, ignorePatterns)
        if (parsed) {
          currentCommit = { date: parsed.date, email: parsed.email, commitId: parsed.commitId, userName: parsed.userName }
          updates.push(parsed)
        } else {
          currentCommit = null
        }
      } else if (currentCommit) {
        // It's a file path line belonging to the current commit
        updates.push(new FileUpdate(currentCommit.date, currentCommit.email, currentCommit.commitId, trimmed, currentCommit.userName))
      }
    }

    return updates
  }

  static getAuthorCommits(updates: FileUpdate[]): AuthorCommit[] {
    const commitMap = new Map<string, AuthorCommit>()

    for (const update of updates) {
      const existing = commitMap.get(update.commitId)
      if (existing) {
        existing.filesUpdated++
      } else {
        const commit = new AuthorCommit(update.date, update.email, update.userName, update.bot)
        commit.commitId = update.commitId
        commitMap.set(update.commitId, commit)
      }
    }

    return Array.from(commitMap.values())
  }

  static getFileHistories(updates: FileUpdate[]): Map<string, CommitInfo[]> {
    const historyMap = new Map<string, CommitInfo[]>()

    for (const update of updates) {
      let commits = historyMap.get(update.path)
      if (!commits) {
        commits = []
        historyMap.set(update.path, commits)
      }
      commits.push(new CommitInfo(update.commitId, update.date, update.email))
    }

    return historyMap
  }
}
