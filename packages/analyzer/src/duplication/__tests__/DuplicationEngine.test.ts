import { beforeEach, describe, expect, test } from "bun:test"
import { SourceFile } from "../../aspects/SourceFile.js"
import { DuplicatedFileBlock } from "../DuplicatedFileBlock.js"
import { DuplicationAggregator } from "../DuplicationAggregator.js"
import { DuplicationEngine } from "../DuplicationEngine.js"
import { DuplicationInstance } from "../DuplicationInstance.js"
import { DuplicationUtils } from "../DuplicationUtils.js"
import { Block } from "../impl/Block.js"
import { FileInfoForDuplication } from "../impl/FileInfoForDuplication.js"
import { LineIndexesExtractor } from "../impl/LineIndexesExtractor.js"
import { LineInfo } from "../impl/LineInfo.js"
import { UnitDuplicatesExtractor } from "../UnitDuplicatesExtractor.js"

describe("LineInfo", () => {
  beforeEach(() => {
    LineInfo.resetCounter()
  })

  test("assigns unique sequential IDs", () => {
    const a = new LineInfo()
    const b = new LineInfo()
    expect(b.id).toBe(a.id + 1)
  })

  test("tracks count and increments", () => {
    const info = new LineInfo()
    expect(info.count).toBe(1)
    info.incrementCount()
    expect(info.count).toBe(2)
  })
})

describe("LineIndexesExtractor", () => {
  beforeEach(() => {
    LineInfo.resetCounter()
  })

  test("assigns same ID to identical lines", () => {
    const extractor = new LineIndexesExtractor()
    const ids = extractor.getLineIDs(["hello", "world", "hello"])
    expect(ids[0]).toBe(ids[2])
    expect(ids[0]).not.toBe(ids[1])
  })

  test("truncates lines longer than MAX_LINE_LENGTH", () => {
    const extractor = new LineIndexesExtractor()
    const longLine = "a".repeat(600)
    const truncatedLine = "a".repeat(500)
    const ids1 = extractor.getLineIDs([longLine])
    const ids2 = extractor.getLineIDs([truncatedLine])
    // Both should map to same ID since they truncate to same string
    expect(ids1[0]).toBe(ids2[0])
  })

  test("clears unique lines (marks lines appearing only once as IGNORE)", () => {
    const extractor = new LineIndexesExtractor()
    // "aaa" appears twice, "bbb" appears once
    const ids = extractor.getLineIDs(["aaa", "bbb", "aaa"])
    extractor.clearUniqueLines(ids)
    expect(ids[0]).not.toBe(FileInfoForDuplication.IGNORE_LINE_INDEX)
    expect(ids[1]).toBe(FileInfoForDuplication.IGNORE_LINE_INDEX)
    expect(ids[2]).not.toBe(FileInfoForDuplication.IGNORE_LINE_INDEX)
  })
})

describe("Block", () => {
  test("generates string key from line indexes", () => {
    const block = new Block([1, 2, 3])
    expect(block.getStringKey()).toBe("1;2;3;")
  })

  test("extracts all possible sub-blocks of given size", () => {
    const block = new Block([10, 20, 30, 40])
    const subs = block.extractAllPossibleSubBlocks(2)
    expect(subs).toHaveLength(3)
    expect(subs[0]!.lineIndexes).toEqual([10, 20])
    expect(subs[1]!.lineIndexes).toEqual([20, 30])
    expect(subs[2]!.lineIndexes).toEqual([30, 40])
  })

  test("equals compares line indexes", () => {
    const a = new Block([1, 2, 3])
    const b = new Block([1, 2, 3])
    const c = new Block([1, 2, 4])
    expect(a.equals(b)).toBe(true)
    expect(a.equals(c)).toBe(false)
  })

  test("throws on sub-block size < 1", () => {
    const block = new Block([1, 2])
    expect(() => block.extractAllPossibleSubBlocks(0)).toThrow()
  })
})

describe("FileInfoForDuplication", () => {
  test("extracts blocks splitting on IGNORE_LINE_INDEX", () => {
    const info = new FileInfoForDuplication()
    info.lineIDs = [1, 2, 3, -1, 4, 5, 6, 7]
    const blocks = info.extractBlocks(3)
    expect(blocks).toHaveLength(2)
    expect(blocks[0]!.lineIndexes).toEqual([1, 2, 3])
    expect(blocks[1]!.lineIndexes).toEqual([4, 5, 6, 7])
  })

  test("filters out blocks smaller than minimum", () => {
    const info = new FileInfoForDuplication()
    info.lineIDs = [1, 2, -1, 3, 4, 5]
    const blocks = info.extractBlocks(3)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.lineIndexes).toEqual([3, 4, 5])
  })

  test("indexesOf finds all occurrences of a block pattern", () => {
    const info = new FileInfoForDuplication()
    info.lineIDs = [1, 2, 3, 4, 1, 2, 3, 5]
    const block = new Block([1, 2, 3])
    const indexes = info.indexesOf(block)
    expect(indexes).toEqual([0, 4])
  })

  test("getBiggestBlockSize returns max block size", () => {
    const info = new FileInfoForDuplication()
    info.lineIDs = [1, 2, -1, 3, 4, 5, 6]
    info.extractBlocks(1)
    expect(info.getBiggestBlockSize()).toBe(4)
  })
})

describe("DuplicationEngine", () => {
  beforeEach(() => {
    LineInfo.resetCounter()
  })

  test("finds no duplicates in unique files", () => {
    const file1 = new SourceFile("a.java", "class A {\n  void foo() {}\n  void bar() {}\n}")
    const file2 = new SourceFile("b.java", "class B {\n  void baz() {}\n  void qux() {}\n}")

    const engine = new DuplicationEngine()
    engine.findDuplicates([file1, file2], 6)

    expect(engine.duplicates).toHaveLength(0)
    expect(engine.numberOfDuplicatedLines).toBe(0)
  })

  test("finds duplicates in files with identical blocks", () => {
    // Create two files with identical 6-line code blocks
    const duplicatedBlock = [
      "public void doSomething() {",
      "  int x = 1;",
      "  int y = 2;",
      "  int z = x + y;",
      "  System.out.println(z);",
      "  return;",
      "}",
    ].join("\n")

    const file1 = new SourceFile("a.java", `class A {\n${duplicatedBlock}\n  void unique1() {}\n}`)
    const file2 = new SourceFile("b.java", `class B {\n${duplicatedBlock}\n  void unique2() {}\n}`)

    const engine = new DuplicationEngine()
    engine.findDuplicates([file1, file2], 6)

    expect(engine.duplicates.length).toBeGreaterThan(0)
    expect(engine.numberOfDuplicatedLines).toBeGreaterThan(0)
    expect(engine.totalCleanedLinesOfCode).toBeGreaterThan(0)
  })

  test("detects duplication within a single file", () => {
    const block = [
      "int x = 1;",
      "int y = 2;",
      "int z = x + y;",
      "System.out.println(z);",
      "x = z + 1;",
      "y = z + 2;",
    ].join("\n")

    const file = new SourceFile(
      "dup.java",
      `class A {\n  void method1() {\n${block}\n  }\n  void method2() {\n${block}\n  }\n}`,
    )

    const engine = new DuplicationEngine()
    engine.findDuplicates([file], 6)

    expect(engine.duplicates.length).toBeGreaterThan(0)
    expect(engine.numberOfDuplicatedLines).toBeGreaterThan(0)
  })
})

describe("DuplicationUtils", () => {
  test("getLinesAsString joins lines in range", () => {
    const lines = ["a", "b", "c", "d"]
    expect(DuplicationUtils.getLinesAsString(lines, 1, 2)).toBe("b\nc")
  })

  test("indexOf finds case-insensitive subsequence", () => {
    const lines = ["Hello", "World", "Foo", "Bar"]
    expect(DuplicationUtils.indexOf(lines, ["hello", "world"])).toBe(0)
    expect(DuplicationUtils.indexOf(lines, ["foo", "bar"])).toBe(2)
    expect(DuplicationUtils.indexOf(lines, ["notfound"])).toBe(-1)
  })

  test("indexOf with startIndex", () => {
    const lines = ["a", "b", "a", "b"]
    expect(DuplicationUtils.indexOf(lines, ["a", "b"], 1)).toBe(2)
  })

  test("getNumberOfDuplicatedLines counts unique lines across blocks", () => {
    const file = new SourceFile("test.java")

    const block1 = new DuplicatedFileBlock()
    block1.sourceFile = file
    block1.cleanedStartLine = 1
    block1.cleanedEndLine = 3

    const block2 = new DuplicatedFileBlock()
    block2.sourceFile = file
    block2.cleanedStartLine = 2
    block2.cleanedEndLine = 5

    const instance = new DuplicationInstance()
    instance.duplicatedFileBlocks = [block1, block2]

    // Lines: 1,2,3 from block1 + 2,3,4,5 from block2 = 5 unique lines
    expect(DuplicationUtils.getNumberOfDuplicatedLines([instance])).toBe(5)
  })
})

describe("DuplicationAggregator", () => {
  test("aggregates duplication per source file", () => {
    const file = new SourceFile("test.java")

    const block1 = new DuplicatedFileBlock()
    block1.sourceFile = file
    block1.cleanedStartLine = 1
    block1.cleanedEndLine = 3

    const block2 = new DuplicatedFileBlock()
    block2.sourceFile = file
    block2.cleanedStartLine = 10
    block2.cleanedEndLine = 12

    const instance = new DuplicationInstance()
    instance.duplicatedFileBlocks = [block1, block2]

    const result = DuplicationAggregator.getDuplicationPerSourceFile([instance])
    expect(result).toHaveLength(1)
    expect(result[0]!.duplicatedLineIndexes).toHaveLength(6) // 1,2,3 + 10,11,12
  })

  test("aggregates duplication per extension", () => {
    const file1 = new SourceFile("a.java")
    file1.cleanedLinesForDuplication = ["line1", "line2", "line3"]
    const file2 = new SourceFile("b.java")
    file2.cleanedLinesForDuplication = ["line4", "line5"]

    const fileDups = [{ sourceFile: file1, cleanedLinesOfCode: 3, duplicatedLineIndexes: [1, 2] }]

    const metrics = DuplicationAggregator.getDuplicationPerExtension([file1, file2], fileDups)
    expect(metrics).toHaveLength(1)
    expect(metrics[0]!.key).toBe("java")
    expect(metrics[0]!.cleanedLinesOfCode).toBe(5)
    expect(metrics[0]!.duplicatedLinesOfCode).toBe(2)
  })
})

describe("UnitDuplicatesExtractor", () => {
  test("finds duplicated units with identical bodies", () => {
    const file = new SourceFile("test.java")
    const body = "void foo() {\n  int x = 1;\n  int y = 2;\n  int z = x + y;\n  return z;\n}"

    const unit1 = {
      shortName: "foo",
      longName: "A.foo",
      sourceFile: file,
      startLine: 1,
      endLine: 6,
      linesOfCode: 6,
      mcCabeIndex: 1,
      numberOfParameters: 0,
      cleanedBody: body,
      body,
      children: [],
    }

    const unit2 = {
      shortName: "bar",
      longName: "B.bar",
      sourceFile: file,
      startLine: 10,
      endLine: 15,
      linesOfCode: 6,
      mcCabeIndex: 1,
      numberOfParameters: 0,
      cleanedBody: body,
      body,
      children: [],
    }

    const extractor = new UnitDuplicatesExtractor()
    const result = extractor.findDuplicatedUnits([unit1, unit2], 3)
    expect(result).toHaveLength(1)
    expect(result[0]!.duplicatedFileBlocks).toHaveLength(2)
  })

  test("filters out units below threshold", () => {
    const body = "void x() {\n  return;\n}"
    const unit1 = {
      shortName: "x",
      longName: "x",
      sourceFile: null,
      startLine: 1,
      endLine: 3,
      linesOfCode: 3,
      mcCabeIndex: 1,
      numberOfParameters: 0,
      cleanedBody: body,
      body,
      children: [],
    }

    const extractor = new UnitDuplicatesExtractor()
    const result = extractor.findDuplicatedUnits([unit1, { ...unit1, startLine: 10, endLine: 12 }], 10)
    expect(result).toHaveLength(0)
  })
})
