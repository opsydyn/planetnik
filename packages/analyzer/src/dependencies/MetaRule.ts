import type { OperationStatement } from "../operations/OperationStatement.js"

export class MetaRule {
  pathPattern: string = ""
  contentPattern: string = ""
  use: string = "content"
  ignoreComments: boolean = false
  nameOperations: OperationStatement[] = []

  constructor(pathPattern: string = "", contentPattern: string = "", use: string = "content") {
    this.pathPattern = pathPattern
    this.contentPattern = contentPattern
    this.use = use
  }
}
