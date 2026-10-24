import { PersonConfig } from "./PersonConfig.js"

export class PeopleConfig {
  people: PersonConfig[] = []

  private cache = new Map<string, PersonConfig>()
  private nameCache = new Map<string, PersonConfig>()

  getPersonFromEmailPatterns(contributorId: string): PersonConfig {
    const cached = this.cache.get(contributorId)
    if (cached) return cached

    for (const person of this.people) {
      for (const pattern of person.emailPatterns) {
        try {
          if (new RegExp(pattern).test(contributorId)) {
            this.cache.set(contributorId, person)
            return person
          }
        } catch {
          // invalid regex
        }
      }
    }

    const fallback = new PersonConfig()
    fallback.name = contributorId
    this.cache.set(contributorId, fallback)
    return fallback
  }

  getPersonByName(name: string): PersonConfig {
    const cached = this.nameCache.get(name)
    if (cached) return cached

    for (const person of this.people) {
      if (person.name === name) {
        this.nameCache.set(name, person)
        return person
      }
    }

    const fallback = new PersonConfig()
    fallback.name = name
    this.nameCache.set(name, fallback)
    return fallback
  }
}
