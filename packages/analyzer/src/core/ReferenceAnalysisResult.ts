export class ReferenceAnalysisResult {
  label: string = "DATE"
  analysisResultsPath: string = ""

  constructor(label: string = "DATE", analysisResultsPath: string = "") {
    this.label = label
    this.analysisResultsPath = analysisResultsPath
  }
}
