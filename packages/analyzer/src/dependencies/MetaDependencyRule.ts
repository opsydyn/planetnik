import { MetaRule } from "./MetaRule.js"

export class MetaDependencyRule extends MetaRule {
  reverseDirection: boolean = false
  color: string = ""

  constructor(pathPattern: string = "", contentPattern: string = "", use: string = "content") {
    super(pathPattern, contentPattern, use)
  }
}
