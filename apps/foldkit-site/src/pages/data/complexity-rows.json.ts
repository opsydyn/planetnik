/**
 * The complexity grid's rows, as a static JSON file.
 *
 * Astro prerenders this to `dist/data/complexity-rows.json` at build time, so
 * the fetch the grid performs is one more static asset from the same origin.
 * The site stays static; the rows simply stop riding inside the HTML, where
 * they were 93% of the compressed page in order to display 25 of them.
 */

import { encodeGridRows } from "@planetnik/report-view-foldkit/tables/grid"
import type { APIRoute } from "astro"

import { complexityGridFields, complexityGridRows, loadUnits } from "../../lib/complexityData.js"

export const prerender = true

export const GET: APIRoute = async () => {
  const payload = encodeGridRows(complexityGridRows(await loadUnits()), complexityGridFields)
  return new Response(JSON.stringify(payload), {
    headers: { "content-type": "application/json; charset=utf-8" },
  })
}
