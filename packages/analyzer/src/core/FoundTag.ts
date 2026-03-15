import type { TagRule } from "./TagRule.js"

export class FoundTag {
  tag: string
  color: string
  evidence: string

  constructor(tagRule: TagRule, evidence: string) {
    this.tag = tagRule.tag
    this.color = tagRule.color
    this.evidence = evidence
  }
}
