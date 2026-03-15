export class ProgressFeedback {
  clear(): void {}
  start(): void {}
  end(): void {}
  setText(_text: string): void {}
  setDetailedText(_text: string): void {}
  canceled(): boolean {
    return false
  }
  progress(_current: number, _total: number): void {}
}
