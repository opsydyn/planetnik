import { NamedSourceCodeAspect } from "./NamedSourceCodeAspect.js"

export class Concern extends NamedSourceCodeAspect {
  constructor(name: string = "") {
    super(name)
  }
}

export class DerivedConcern extends Concern {
  constructor(name: string = "") {
    super(name)
  }
}
