import type { OperationStatement } from "./OperationStatement.js"

export class ComplexOperation {
  private operations: OperationStatement[]

  constructor(operations: OperationStatement[] = []) {
    this.operations = operations
  }

  exec(input: string): string {
    let result = input
    for (const op of this.operations) {
      result = ComplexOperation.execSingle(op, result)
    }
    return result
  }

  private static execSingle(op: OperationStatement, input: string): string {
    switch (op.op.toLowerCase()) {
      case "extract": {
        if (op.params.length === 0) return input
        try {
          const match = input.match(new RegExp(op.params[0]))
          return match ? match[0] : input
        } catch {
          return input
        }
      }
      case "remove": {
        if (op.params.length === 0) return input
        try {
          return input.replace(new RegExp(op.params[0], "g"), "")
        } catch {
          return input
        }
      }
      case "replace": {
        if (op.params.length < 2) return input
        try {
          return input.replace(new RegExp(op.params[0], "g"), op.params[1])
        } catch {
          return input
        }
      }
      case "trim":
        return input.trim()
      case "uppercase":
        return input.toUpperCase()
      case "lowercase":
        return input.toLowerCase()
      case "append":
        return op.params.length > 0 ? input + op.params[0] : input
      case "prepend":
        return op.params.length > 0 ? op.params[0] + input : input
      default:
        return input
    }
  }
}
