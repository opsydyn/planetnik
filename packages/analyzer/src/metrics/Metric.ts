export class Metric {
  id: string = ""
  value: number = 0
  description: string = ""

  setId(name: string): this {
    this.id = name.toUpperCase().replace(/[^A-Z0-9_]/g, "_")
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
