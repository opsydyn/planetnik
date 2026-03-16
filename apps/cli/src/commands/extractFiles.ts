import { existsSync, copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, relative, resolve } from "node:path"
import { Command, Options } from "@effect/cli"
import { Effect } from "effect"
import { Glob } from "bun"

const analysisRoot = Options.text("analysisRoot").pipe(Options.withDefault("."))
const pattern = Options.text("pattern")
const destFolder = Options.text("destFolder")

export const extractFilesCommand = Command.make(
  "extractFiles",
  { analysisRoot, pattern, destFolder },
  (args) =>
    Effect.gen(function* () {
      const root = resolve(args.analysisRoot)
      if (!existsSync(root)) {
        yield* Effect.logError(`The analysis root "${root}" does not exist.`)
        return
      }

      const dest = resolve(root, args.destFolder)
      mkdirSync(dest, { recursive: true })

      yield* Effect.log(`Extracting files matching "${args.pattern}" to ${dest}...`)

      const regex = new RegExp(args.pattern)
      let count = 0

      // Walk the source directory and find matching files
      const glob = new Glob("**/*")
      for (const filePath of glob.scanSync({ cwd: root, onlyFiles: true })) {
        if (regex.test(filePath)) {
          const srcFile = join(root, filePath)
          const destFile = join(dest, filePath)
          mkdirSync(dirname(destFile), { recursive: true })
          copyFileSync(srcFile, destFile)
          count++
        }
      }

      // Also extract matching git history lines if git-history.txt exists
      const gitHistoryFile = join(root, "git-history.txt")
      if (existsSync(gitHistoryFile)) {
        const content = readFileSync(gitHistoryFile, "utf-8")
        const lines = content.split("\n")
        const filtered: string[] = []
        for (const line of lines) {
          const parts = line.split(" ")
          if (parts.length >= 4 && regex.test(parts[3]!)) {
            filtered.push(line)
          }
        }
        if (filtered.length > 0) {
          writeFileSync(join(dest, "git-history.txt"), filtered.join("\n"), "utf-8")
        }
      }

      yield* Effect.log(`Extracted ${count} files.`)
    }),
)
