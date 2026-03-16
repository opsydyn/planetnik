export class ContributorPerExtensionStats {
  contributor: string
  fileUpdates30Days: number = 0
  fileUpdates90Days: number = 0
  fileUpdates: number = 0

  constructor(contributor: string = "") {
    this.contributor = contributor
  }
}
