export class NumericMetric {
  name: string
  value: number
  description: NumericMetric[] = []

  constructor(name: string = "", value: number = 0) {
    this.name = name
    this.value = value
  }
}
