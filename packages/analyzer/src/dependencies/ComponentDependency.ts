import type { DependencyEvidence } from "./DependencyEvidence.js"

export class ComponentDependency {
  fromComponent: string
  toComponent: string
  count: number = 1
  locFrom: number = 0
  evidence: DependencyEvidence[] = []
  color: string = ""

  constructor(fromComponent: string = "", toComponent: string = "") {
    this.fromComponent = fromComponent
    this.toComponent = toComponent
  }

  getDependencyString(): string {
    const prefix = this.color ? `${this.color} / ` : ""
    return `${prefix}${this.fromComponent} -> ${this.toComponent}`
  }

  hasPathFrom(path: string): boolean {
    return this.evidence.some((e) => e.pathFrom.toLowerCase() === path.toLowerCase())
  }

  increment(delta: number): void {
    this.count += delta
  }
}
