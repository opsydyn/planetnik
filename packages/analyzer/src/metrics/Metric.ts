export class Metric {
  id: string = ""
  value: number = 0
  description: string = ""

  setId(id: string): this {
    this.id = id
    return this
  }

  setValue(value: number): this {
    this.value = value
    return this
  }

  setDescription(description: string): this {
    this.description = description
    return this
  }
}
