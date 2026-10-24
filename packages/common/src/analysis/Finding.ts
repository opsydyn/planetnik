import { Schema } from "effect"

export const Assessment = Schema.Literals(["positive", "negative", "neutral", "none"])
export type Assessment = typeof Assessment.Type

export class Finding {
  constructor(
    readonly assessment: Assessment,
    readonly shortDescription: string,
    readonly detailedDescription: string = "",
    readonly type: string = "",
    readonly searchPhrase: string = "",
  ) {}

  withDetailedDescription(description: string): Finding {
    return new Finding(this.assessment, this.shortDescription, description, this.type, this.searchPhrase)
  }

  static positive(description: string): Finding {
    return new Finding("positive", description)
  }

  static negative(description: string): Finding {
    return new Finding("negative", description)
  }

  static neutral(description: string): Finding {
    return new Finding("neutral", description)
  }

  static withoutOpinion(description: string): Finding {
    return new Finding("none", description)
  }

  toString(): string {
    const displayText =
      this.assessment === "positive"
        ? "+"
        : this.assessment === "negative"
          ? "-"
          : this.assessment === "neutral"
            ? "o"
            : ""
    const prefix = displayText ? `[${displayText}] ` : ""
    return `${prefix}${this.shortDescription}`
  }
}
