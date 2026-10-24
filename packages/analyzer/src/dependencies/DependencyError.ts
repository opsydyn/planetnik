export class DependencyError {
  message: string
  filtering: string

  constructor(message: string = "", filtering: string = "") {
    this.message = message
    this.filtering = filtering
  }
}
