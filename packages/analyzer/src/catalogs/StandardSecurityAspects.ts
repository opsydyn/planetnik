import { Concern } from "../aspects/Concern.js"
import { ConcernsGroup } from "../aspects/ConcernsGroup.js"

export class StandardSecurityAspects extends ConcernsGroup {
  constructor() {
    super("security")
    this.concerns.push(
      new Concern("authentication"),
      new Concern("session management"),
      new Concern("access control"),
      new Concern("input/output validation"),
      new Concern("cryptography"),
      new Concern("error logging"),
      new Concern("data protection"),
      new Concern("communications"),
      new Concern("file operations"),
    )
  }
}
