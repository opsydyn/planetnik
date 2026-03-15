import { CommitInfo } from "./CommitInfo.js"

export interface FileUpdate {
  date: string
  email: string
  commitId: string
  path: string
}

export interface AuthorCommit {
  commitId: string
  email: string
  date: string
  filesUpdated: number
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
    const secondSpace = afterEmail.indexOf(" ")
    if (secondSpace < 0) return null

    const commitId = afterEmail.substring(0, secondSpace)
    const path = afterEmail.substring(secondSpace + 1).replace(/&nbsp;/g, " ")

    if (GitHistoryUtils.shouldIgnore(email, ignorePatterns)) return null

    return { date, email, commitId, path }
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
    let currentCommit: { date: string; email: string; commitId: string } | null = null

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
          currentCommit = { date: parsed.date, email: parsed.email, commitId: parsed.commitId }
          updates.push(parsed)
        } else {
          currentCommit = null
        }
      } else if (currentCommit) {
        // It's a file path line belonging to the current commit
        updates.push({
          date: currentCommit.date,
          email: currentCommit.email,
          commitId: currentCommit.commitId,
          path: trimmed,
        })
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
        commitMap.set(update.commitId, {
          commitId: update.commitId,
          email: update.email,
          date: update.date,
          filesUpdated: 1,
        })
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
