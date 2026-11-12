import manifest from "../../data/dataset-catalog.json"
import { resolveDatasetsRoot } from "../../loaders/planetnik-loader.js"
import { buildDatasetCatalog, type DatasetCatalogBuildResult, parseDatasetCatalogSeeds } from "./datasetCatalog.js"

export function loadDatasetCatalog(options: { datasetsRoot?: string } = {}): DatasetCatalogBuildResult {
  return buildDatasetCatalog({
    datasetsRoot: options.datasetsRoot ?? resolveDatasetsRoot(),
    curation: parseDatasetCatalogSeeds(manifest),
  })
}
