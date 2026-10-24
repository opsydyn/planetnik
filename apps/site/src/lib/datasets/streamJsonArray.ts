import { createReadStream } from "node:fs"

export type StreamJsonArrayObjectsOptions = {
  readonly highWaterMark?: number
}

export type StreamJsonArrayObject = {
  readonly index: number
  readonly value: Record<string, unknown>
}

type Container = "object" | "array"

const whitespace = /\s/u

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

class JsonArrayObjectParser {
  private mode: "search" | "array" | "done" = "search"
  private readonly stack: Container[] = []
  private rootStarted = false
  private rootClosed = false
  private lastSignificant: string | undefined
  private inString = false
  private escaped = false
  private stringRaw = ""
  private stringIsRootKey = false
  private pendingKey = false
  private awaitingArrayStart = false
  private targetFound = false

  private arrayInString = false
  private arrayEscaped = false
  private arrayObjectDepth = 0
  private arrayObjectText = ""
  private arrayHasValue = false
  private arrayExpectValue = true
  private arrayIndex = 0

  constructor(private readonly key: string) {}

  push(text: string): StreamJsonArrayObject[] {
    const entries: StreamJsonArrayObject[] = []
    for (const character of text) {
      if (this.mode === "array") this.consumeArrayCharacter(character, entries)
      else this.consumeDocumentCharacter(character)
    }
    return entries
  }

  finish(): void {
    if (this.inString || this.arrayInString || this.arrayObjectDepth > 0 || this.mode === "array") {
      throw new Error("unterminated JSON document while reading the target array")
    }
    if (!this.rootStarted || !this.rootClosed || this.stack.length !== 0) {
      throw new Error("unterminated JSON document while reading the target array")
    }
    if (!this.targetFound) throw new Error(`array '${this.key}' was not found in the JSON document`)
  }

  private consumeDocumentCharacter(character: string): void {
    if (this.mode === "done") {
      if (!whitespace.test(character)) throw new Error("invalid JSON after the root object")
      return
    }

    if (this.inString) {
      if (this.escaped) {
        this.stringRaw += character
        this.escaped = false
      } else if (character === "\\") {
        this.stringRaw += character
        this.escaped = true
      } else if (character === '"') {
        this.inString = false
        let value: unknown
        try {
          value = JSON.parse(`"${this.stringRaw}"`)
        } catch {
          throw new Error("invalid JSON string while reading the target array")
        }
        if (this.stringIsRootKey && value === this.key) {
          if (this.targetFound) throw new Error(`duplicate top-level array key '${this.key}'`)
          this.pendingKey = true
        }
      } else {
        this.stringRaw += character
      }
      return
    }

    if (character === '"') {
      if (this.rootClosed) throw new Error("invalid JSON after the root object")
      this.inString = true
      this.escaped = false
      this.stringRaw = ""
      this.stringIsRootKey =
        this.stack.length === 1 &&
        this.stack[0] === "object" &&
        (this.lastSignificant === "{" || this.lastSignificant === ",")
      return
    }
    if (whitespace.test(character)) return

    if (this.pendingKey) {
      if (character !== ":") this.pendingKey = false
      else {
        this.pendingKey = false
        this.awaitingArrayStart = true
        this.lastSignificant = character
        return
      }
    }
    if (this.awaitingArrayStart) {
      if (character === "[") {
        this.awaitingArrayStart = false
        this.targetFound = true
        this.mode = "array"
        this.arrayInString = false
        this.arrayEscaped = false
        this.arrayObjectDepth = 0
        this.arrayObjectText = ""
        this.arrayHasValue = false
        this.arrayExpectValue = true
        this.arrayIndex = 0
        this.lastSignificant = character
        return
      }
      this.awaitingArrayStart = false
    }

    if (!this.rootStarted) {
      if (character !== "{") throw new Error("JSON document must start with an object")
      this.rootStarted = true
      this.stack.push("object")
      this.lastSignificant = character
      return
    }
    if (this.stack.length === 0) throw new Error("invalid JSON after the root object")

    if (character === "{" || character === "[") {
      this.stack.push(character === "{" ? "object" : "array")
    } else if (character === "}" || character === "]") {
      const expected: Container = character === "}" ? "object" : "array"
      if (this.stack.pop() !== expected) throw new Error("malformed JSON container while reading the target array")
      if (this.stack.length === 0) {
        this.rootClosed = true
        this.mode = "done"
      }
    }
    this.lastSignificant = character
  }

  private consumeArrayCharacter(character: string, entries: StreamJsonArrayObject[]): void {
    if (this.arrayObjectDepth > 0) {
      this.arrayObjectText += character
      if (this.arrayInString) {
        if (this.arrayEscaped) this.arrayEscaped = false
        else if (character === "\\") this.arrayEscaped = true
        else if (character === '"') this.arrayInString = false
        return
      }
      if (character === '"') {
        this.arrayInString = true
        this.arrayEscaped = false
      } else if (character === "{") {
        this.arrayObjectDepth += 1
      } else if (character === "}") {
        this.arrayObjectDepth -= 1
        if (this.arrayObjectDepth === 0) {
          let value: unknown
          try {
            value = JSON.parse(this.arrayObjectText)
          } catch {
            throw new Error(`invalid object record at index ${this.arrayIndex} in array '${this.key}'`)
          }
          if (!isRecord(value)) throw new Error(`array '${this.key}' must contain only object records`)
          entries.push({ index: this.arrayIndex, value })
          this.arrayIndex += 1
          this.arrayHasValue = true
          this.arrayExpectValue = false
          this.arrayObjectText = ""
        }
      }
      return
    }

    if (whitespace.test(character)) return
    if (character === "{") {
      if (!this.arrayExpectValue) throw new Error(`missing comma in array '${this.key}'`)
      this.arrayObjectDepth = 1
      this.arrayObjectText = character
      return
    }
    if (character === ",") {
      if (this.arrayExpectValue) throw new Error(`unexpected comma in array '${this.key}'`)
      this.arrayExpectValue = true
      return
    }
    if (character === "]") {
      if (this.arrayExpectValue && this.arrayHasValue) throw new Error(`trailing comma in array '${this.key}'`)
      this.mode = "search"
      this.lastSignificant = character
      this.arrayInString = false
      this.arrayEscaped = false
      this.arrayObjectText = ""
      this.arrayObjectDepth = 0
      return
    }
    throw new Error(`array '${this.key}' must contain only object records`)
  }
}

/** Stream object members from one named top-level JSON array without loading the enclosing shard. */
export async function* streamJsonArrayObjects(
  path: string,
  key: string,
  options: StreamJsonArrayObjectsOptions = {},
): AsyncGenerator<StreamJsonArrayObject> {
  if (!key.trim()) throw new Error("array key must be a non-empty string")
  const highWaterMark = options.highWaterMark ?? 1024 * 1024
  if (!Number.isInteger(highWaterMark) || highWaterMark < 1) throw new Error("highWaterMark must be a positive integer")

  const parser = new JsonArrayObjectParser(key)
  const decoder = new TextDecoder("utf-8", { fatal: true })
  try {
    for await (const chunk of createReadStream(path, { highWaterMark })) {
      let text: string
      try {
        text = decoder.decode(chunk, { stream: true })
      } catch {
        throw new Error(`invalid UTF-8 while reading '${path}'`)
      }
      for (const entry of parser.push(text)) yield entry
    }
    let finalText: string
    try {
      finalText = decoder.decode()
    } catch {
      throw new Error(`invalid UTF-8 while reading '${path}'`)
    }
    for (const entry of parser.push(finalText)) yield entry
    parser.finish()
  } catch (error) {
    if (error instanceof Error) throw error
    throw new Error(`unable to stream JSON array '${key}' from '${path}': ${String(error)}`)
  }
}
