export interface Dependency {
  readonly fromComponent: string
  readonly toComponent: string
  readonly fromFiles: string[]
  readonly toFiles: string[]
  readonly count: number
}

export interface DependencyError {
  readonly message: string
  readonly sourceFile: string
  readonly filtering: string
}

export class DependenciesAnalysis {
  dependencies: Dependency[] = []
  errors: DependencyError[] = []
}
