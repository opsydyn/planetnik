export class OperationStatement {
  op: string
  params: string[]

  constructor(op: string = "", params: string[] = []) {
    this.op = op
    this.params = params
  }
}
