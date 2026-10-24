export enum FragmentType {
  HTML = "HTML",
  GRAPHVIZ = "GRAPHVIZ",
  SVG = "SVG",
}

export class RichTextFragment {
  id: string
  fragment: string
  description: string
  show: boolean
  type: FragmentType

  constructor(fragment: string = "", type: FragmentType = FragmentType.HTML, id: string = "") {
    this.id = id
    this.fragment = fragment
    this.description = ""
    this.show = true
    this.type = type
  }
}
