import type { RepositoryTag } from "./RepositoryTag.js"

export class TagGroup {
  name: string = ""
  description: string = ""
  tags: RepositoryTag[] = []
}
