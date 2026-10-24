import { Effect } from "effect"

export class JsonMapper {
  static generate(obj: unknown): string {
    return JSON.stringify(obj, null, 2)
  }

  static generateCompressed(obj: unknown): string {
    return JSON.stringify(obj)
  }

  static parse<T>(json: string): Effect.Effect<T, JsonParseError> {
    return Effect.try({
      try: () => JSON.parse(json) as T,
      catch: (error) => new JsonParseError(error instanceof Error ? error.message : "Unknown parse error", json),
    })
  }
}

export class JsonParseError {
  readonly _tag = "JsonParseError"
  constructor(
    readonly message: string,
    readonly input: string,
  ) {}
}
