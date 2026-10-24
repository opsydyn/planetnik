export class DependencyEvidence {
  pathFrom: string
  evidence: string

  constructor(pathFrom: string, evidence: string) {
    this.pathFrom = pathFrom
    this.evidence = evidence
  }
}
