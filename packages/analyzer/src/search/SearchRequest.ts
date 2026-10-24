import { SearchExpression } from "./SearchExpression.js"

export class SearchRequest {
  pathSearchExpression: SearchExpression
  contentSearchExpression: SearchExpression

  constructor(
    pathSearchExpression: SearchExpression = new SearchExpression(""),
    contentSearchExpression: SearchExpression = new SearchExpression(""),
  ) {
    this.pathSearchExpression = pathSearchExpression
    this.contentSearchExpression = contentSearchExpression
  }
}
