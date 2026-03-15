export class ComponentDependency {
  fromComponent: string
  toComponent: string
  count: number = 1

  constructor(fromComponent: string = "", toComponent: string = "") {
    this.fromComponent = fromComponent
    this.toComponent = toComponent
  }
}
