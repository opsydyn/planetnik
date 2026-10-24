let idCounter = 0

export class LineInfo {
  readonly id: number
  private _count: number = 1

  constructor() {
    this.id = idCounter++
  }

  static resetCounter(): void {
    idCounter = 0
  }

  get count(): number {
    return this._count
  }

  incrementCount(): void {
    this._count++
  }
}
