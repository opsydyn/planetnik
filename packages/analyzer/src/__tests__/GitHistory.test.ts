import { describe, expect, test } from "bun:test"
import { CommitsPerExtension } from "../githistory/CommitsPerExtension.js"
import { ContributorPerExtensionStats } from "../githistory/ContributorPerExtensionStats.js"
import { ExtractGitHistoryFileHandler } from "../githistory/ExtractGitHistoryFileHandler.js"
import { GitHistoryPerExtensionUtils } from "../githistory/GitHistoryPerExtensionUtils.js"
import { AuthorCommit, FileUpdate, GitHistoryUtils } from "../githistory/GitHistoryUtils.js"

describe("FileUpdate", () => {
  test("constructs with all fields", () => {
    const fu = new FileUpdate("2024-01-15", "alice@test.com", "abc123", "src/app.ts", "Alice", true)
    expect(fu.date).toBe("2024-01-15")
    expect(fu.email).toBe("alice@test.com")
    expect(fu.commitId).toBe("abc123")
    expect(fu.path).toBe("src/app.ts")
    expect(fu.userName).toBe("Alice")
    expect(fu.bot).toBe(true)
  })

  test("defaults userName and bot", () => {
    const fu = new FileUpdate("2024-01-15", "alice@test.com", "abc123", "src/app.ts")
    expect(fu.userName).toBe("")
    expect(fu.bot).toBe(false)
  })

  test("getExtension returns lowercase extension", () => {
    expect(new FileUpdate("", "", "", "src/App.TSX").getExtension()).toBe("tsx")
    expect(new FileUpdate("", "", "", "src/main.rs").getExtension()).toBe("rs")
    expect(new FileUpdate("", "", "", "Makefile").getExtension()).toBe("")
  })

  test("getExtension handles backslashes", () => {
    expect(new FileUpdate("", "", "", "src\\main\\App.Java").getExtension()).toBe("java")
  })
})

describe("AuthorCommit", () => {
  test("constructs with defaults", () => {
    const ac = new AuthorCommit()
    expect(ac.date).toBe("")
    expect(ac.email).toBe("")
    expect(ac.userName).toBe("")
    expect(ac.bot).toBe(false)
    expect(ac.filesUpdated).toBe(1)
    expect(ac.commitId).toBe("")
  })

  test("getYear extracts year", () => {
    const ac = new AuthorCommit("2024-03-15")
    expect(ac.getYear()).toBe("2024")
  })

  test("getYear returns empty for short date", () => {
    const ac = new AuthorCommit("202")
    expect(ac.getYear()).toBe("")
  })

  test("getMonth extracts year-month", () => {
    const ac = new AuthorCommit("2024-03-15")
    expect(ac.getMonth()).toBe("2024-03")
  })

  test("getMonth returns empty for short date", () => {
    const ac = new AuthorCommit("2024-0")
    expect(ac.getMonth()).toBe("")
  })

  test("getWeekOfYear rolls back to Monday", () => {
    // 2024-03-15 is a Friday, Monday was 2024-03-11
    const ac = new AuthorCommit("2024-03-15")
    expect(ac.getWeekOfYear()).toBe("2024-03-11")
  })

  test("getWeekOfYear returns Monday unchanged", () => {
    // 2024-03-11 is a Monday
    const ac = new AuthorCommit("2024-03-11")
    expect(ac.getWeekOfYear()).toBe("2024-03-11")
  })

  test("getWeekOfYear returns empty for short date", () => {
    const ac = new AuthorCommit("2024-03")
    expect(ac.getWeekOfYear()).toBe("")
  })
})

describe("GitHistoryUtils.parseLine", () => {
  test("parses a valid line", () => {
    const line = "2024-01-15 alice@test.com abc123 src/app.ts"
    const result = GitHistoryUtils.parseLine(line)
    expect(result).not.toBeNull()
    expect(result!.date).toBe("2024-01-15")
    expect(result!.email).toBe("alice@test.com")
    expect(result!.commitId).toBe("abc123")
    expect(result!.path).toBe("src/app.ts")
  })

  test("returns null for short lines", () => {
    expect(GitHistoryUtils.parseLine("")).toBeNull()
    expect(GitHistoryUtils.parseLine("short")).toBeNull()
  })

  test("returns null for dates before earliest", () => {
    expect(GitHistoryUtils.parseLine("1970-01-01 a@b.com abc path")).toBeNull()
  })

  test("filters by ignore patterns", () => {
    const line = "2024-01-15 bot@ci.com abc123 src/app.ts"
    expect(GitHistoryUtils.parseLine(line, ["bot@"])).toBeNull()
    expect(GitHistoryUtils.parseLine(line, ["human@"])).not.toBeNull()
  })

  test("replaces &nbsp; in paths", () => {
    const line = "2024-01-15 a@b.com abc123 src/my&nbsp;file.ts"
    const result = GitHistoryUtils.parseLine(line)
    expect(result!.path).toBe("src/my file.ts")
  })

  test("parses new tab-separated format with author name", () => {
    const line = "2024-01-15 alice@test.com abc12345678901234567890123456789012345678 Alice Smith\tsrc/app.ts"
    const result = GitHistoryUtils.parseLine(line)
    expect(result).not.toBeNull()
    expect(result!.date).toBe("2024-01-15")
    expect(result!.email).toBe("alice@test.com")
    expect(result!.commitId).toBe("abc12345678901234567890123456789012345678")
    expect(result!.userName).toBe("Alice Smith")
    expect(result!.path).toBe("src/app.ts")
  })

  test("parses tab format with author name containing spaces", () => {
    const line = "2024-01-15 a@b.com abc123 Jean-Claude Van Damme\tsrc/main.ts"
    const result = GitHistoryUtils.parseLine(line)
    expect(result!.userName).toBe("Jean-Claude Van Damme")
    expect(result!.path).toBe("src/main.ts")
  })

  test("parses tab format with no author name", () => {
    const line = "2024-01-15 a@b.com abc123\tsrc/main.ts"
    const result = GitHistoryUtils.parseLine(line)
    expect(result!.userName).toBe("")
    expect(result!.path).toBe("src/main.ts")
  })
})

describe("GitHistoryUtils.parseGitHistoryLines", () => {
  test("parses multi-line git log output", () => {
    const lines = [
      "2024-01-15 alice@test.com abc123 src/main.ts",
      "src/util.ts",
      "src/index.ts",
      "",
      "2024-01-14 bob@test.com def456 src/other.ts",
    ]
    const updates = GitHistoryUtils.parseGitHistoryLines(lines)
    expect(updates.length).toBe(4)
    // First line is commit header + first file
    expect(updates[0]!.path).toBe("src/main.ts")
    expect(updates[0]!.email).toBe("alice@test.com")
    // Subsequent lines inherit commit info
    expect(updates[1]!.path).toBe("src/util.ts")
    expect(updates[1]!.email).toBe("alice@test.com")
    expect(updates[1]!.commitId).toBe("abc123")
    expect(updates[2]!.path).toBe("src/index.ts")
    // After blank line, new commit
    expect(updates[3]!.path).toBe("src/other.ts")
    expect(updates[3]!.email).toBe("bob@test.com")
  })

  test("skips ignored emails", () => {
    const lines = ["2024-01-15 bot@ci.com abc123 src/main.ts", "src/util.ts"]
    const updates = GitHistoryUtils.parseGitHistoryLines(lines, ["bot@"])
    expect(updates.length).toBe(0)
  })

  test("parses tab-separated format and propagates userName", () => {
    const lines = [
      "2024-01-15 alice@test.com abc123 Alice Smith\tsrc/main.ts",
      "src/util.ts",
      "",
      "2024-01-14 bob@test.com def456 Bob Jones\tsrc/other.ts",
    ]
    const updates = GitHistoryUtils.parseGitHistoryLines(lines)
    expect(updates.length).toBe(3)
    expect(updates[0]!.userName).toBe("Alice Smith")
    expect(updates[0]!.path).toBe("src/main.ts")
    // Subsequent file lines inherit userName
    expect(updates[1]!.userName).toBe("Alice Smith")
    expect(updates[1]!.path).toBe("src/util.ts")
    expect(updates[2]!.userName).toBe("Bob Jones")
  })
})

describe("GitHistoryUtils.getAuthorCommits", () => {
  test("groups file updates by commit", () => {
    const updates = [
      new FileUpdate("2024-01-15", "alice@test.com", "abc123", "src/a.ts"),
      new FileUpdate("2024-01-15", "alice@test.com", "abc123", "src/b.ts"),
      new FileUpdate("2024-01-14", "bob@test.com", "def456", "src/c.ts"),
    ]
    const commits = GitHistoryUtils.getAuthorCommits(updates)
    expect(commits.length).toBe(2)
    const commit1 = commits.find((c) => c.commitId === "abc123")!
    expect(commit1.filesUpdated).toBe(2)
    expect(commit1.email).toBe("alice@test.com")
    const commit2 = commits.find((c) => c.commitId === "def456")!
    expect(commit2.filesUpdated).toBe(1)
  })
})

describe("GitHistoryUtils.getFileHistories", () => {
  test("groups commits by file path", () => {
    const updates = [
      new FileUpdate("2024-01-15", "alice@test.com", "abc123", "src/a.ts"),
      new FileUpdate("2024-01-14", "bob@test.com", "def456", "src/a.ts"),
      new FileUpdate("2024-01-15", "alice@test.com", "abc123", "src/b.ts"),
    ]
    const histories = GitHistoryUtils.getFileHistories(updates)
    expect(histories.size).toBe(2)
    expect(histories.get("src/a.ts")!.length).toBe(2)
    expect(histories.get("src/b.ts")!.length).toBe(1)
  })
})

describe("GitHistoryPerExtensionUtils", () => {
  test("groups file updates by extension", () => {
    const updates = [
      new FileUpdate("2024-01-15", "alice@test.com", "abc1", "src/a.ts"),
      new FileUpdate("2024-01-15", "bob@test.com", "abc2", "src/b.ts"),
      new FileUpdate("2024-01-15", "alice@test.com", "abc3", "src/c.java"),
    ]
    const utils = new GitHistoryPerExtensionUtils()
    const result = utils.getCommitsPerExtensions(updates)

    expect(result.length).toBe(2)
    const ts = result.find((r) => r.extension === "ts")!
    expect(ts.commitsCount).toBe(2)
    expect(ts.committers).toContain("alice@test.com")
    expect(ts.committers).toContain("bob@test.com")

    const java = result.find((r) => r.extension === "java")!
    expect(java.commitsCount).toBe(1)
    expect(java.committers).toEqual(["alice@test.com"])
  })

  test("tracks contributor stats per extension", () => {
    const updates = [
      new FileUpdate("2024-01-15", "alice@test.com", "abc1", "src/a.ts"),
      new FileUpdate("2024-01-15", "alice@test.com", "abc2", "src/b.ts"),
      new FileUpdate("2024-01-15", "bob@test.com", "abc3", "src/c.ts"),
    ]
    const utils = new GitHistoryPerExtensionUtils()
    const result = utils.getCommitsPerExtensions(updates)
    const ts = result.find((r) => r.extension === "ts")!

    expect(ts.contributorPerExtensionStats.length).toBe(2)
    const aliceStats = ts.contributorPerExtensionStats.find((s) => s.contributor === "alice@test.com")!
    expect(aliceStats.fileUpdates).toBe(2)
    const bobStats = ts.contributorPerExtensionStats.find((s) => s.contributor === "bob@test.com")!
    expect(bobStats.fileUpdates).toBe(1)
  })

  test("returns empty array for no updates", () => {
    const utils = new GitHistoryPerExtensionUtils()
    const result = utils.getCommitsPerExtensions([])
    expect(result).toEqual([])
  })
})

describe("CommitsPerExtension", () => {
  test("initializes with defaults", () => {
    const cpe = new CommitsPerExtension("ts")
    expect(cpe.extension).toBe("ts")
    expect(cpe.commitsCount).toBe(0)
    expect(cpe.committers).toEqual([])
    expect(cpe.filesCount).toBe(0)
  })
})

describe("ContributorPerExtensionStats", () => {
  test("initializes with defaults", () => {
    const stats = new ContributorPerExtensionStats("alice@test.com")
    expect(stats.contributor).toBe("alice@test.com")
    expect(stats.fileUpdates).toBe(0)
    expect(stats.fileUpdates30Days).toBe(0)
    expect(stats.fileUpdates90Days).toBe(0)
  })
})

describe("ExtractGitHistoryFileHandler", () => {
  const SAMPLE_LINES = [
    "2019-11-09 zeljko@sokrates.dev 0bc5d03 codeexplorer/src/test/RegexUtilsTest.java",
    "2020-01-01 zeljko@sokrates.dev be8166a common/pom.xml",
    "2019-12-10 zeljko@sokrates.dev f92899e common/pom.xml",
    "2019-11-09 zeljko@sokrates.dev 0bc5d03 common/pom.xml",
    "2019-12-10 zeljko@sokrates.dev f92899e common/src/main/Finding.java",
    "2019-11-09 zeljko@sokrates.dev 0bc5d03 common/src/main/Finding.java",
  ]

  test("extracts sub-history by prefix and strips prefix", () => {
    const handler = new ExtractGitHistoryFileHandler()
    const result = handler.extractSubHistory(SAMPLE_LINES, "common")

    expect(result.length).toBe(5)
    expect(result[0]).toBe("2020-01-01 zeljko@sokrates.dev be8166a pom.xml")
    expect(result[1]).toBe("2019-12-10 zeljko@sokrates.dev f92899e pom.xml")
    expect(result[2]).toBe("2019-11-09 zeljko@sokrates.dev 0bc5d03 pom.xml")
    expect(result[3]).toBe("2019-12-10 zeljko@sokrates.dev f92899e src/main/Finding.java")
    expect(result[4]).toBe("2019-11-09 zeljko@sokrates.dev 0bc5d03 src/main/Finding.java")
  })

  test("extracts different prefix", () => {
    const handler = new ExtractGitHistoryFileHandler()
    const result = handler.extractSubHistory(SAMPLE_LINES, "codeexplorer")

    expect(result.length).toBe(1)
    expect(result[0]).toBe("2019-11-09 zeljko@sokrates.dev 0bc5d03 src/test/RegexUtilsTest.java")
  })

  test("returns empty for non-matching prefix", () => {
    const handler = new ExtractGitHistoryFileHandler()
    const result = handler.extractSubHistory(SAMPLE_LINES, "nonexistent")
    expect(result).toEqual([])
  })

  test("handles lines with fewer than 4 elements", () => {
    const handler = new ExtractGitHistoryFileHandler()
    const result = handler.extractSubHistory(["short line", ""], "common")
    expect(result).toEqual([])
  })

  test("strips leading slash after prefix removal", () => {
    const lines = ["2024-01-15 a@b.com abc123 common/src/app.ts"]
    const handler = new ExtractGitHistoryFileHandler()
    const result = handler.extractSubHistory(lines, "common/")

    expect(result.length).toBe(1)
    expect(result[0]).toBe("2024-01-15 a@b.com abc123 src/app.ts")
  })
})
