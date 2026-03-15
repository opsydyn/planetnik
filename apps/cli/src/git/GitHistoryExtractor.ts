import { appendFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import simpleGit from "simple-git"

const GIT_HISTORY_FILE = "git-history.txt"

export async function extractGitHistory(root: string): Promise<number> {
  const git = simpleGit(root)
  const outputPath = join(root, GIT_HISTORY_FILE)

  // Clear the file
  writeFileSync(outputPath, "", "utf-8")

  // Get all commits with diff
  const log = await git.log(["--name-only", "--format=%ad %ae %H", "--date=short"])
  let count = 0

  for (const commit of log.all) {
    const date = commit.date.slice(0, 10) // YYYY-MM-DD
    const email = commit.author_email
    const hash = commit.hash

    // Get the files changed in this commit
    const diff = await git.diff(["--name-only", `${hash}^..${hash}`]).catch(() => "")
    const files = diff
      .split("\n")
      .map((f) => f.trim())
      .filter(Boolean)

    for (const filePath of files) {
      const safePath = filePath.replace(/ /g, "&nbsp;")
      const line = `${date} ${email} ${hash} ${safePath}`
      appendFileSync(outputPath, `${line}\n`, "utf-8")
      count++
    }
  }

  return count
}
