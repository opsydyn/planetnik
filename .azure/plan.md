# Azure plan

Status: Ready for Validation

## Goal

Add production dataset storage for `planetnik-runtime` so report creation can resolve named datasets such as `effect-ts` under `/workspace/datasets/<name>/...`, matching the runtime resolver.

## Current findings

- `planetnik-runtime` and `planetnik-app` are deployed and networked correctly.
- `OPENAI_API_KEY` is deployed on `planetnik-runtime`.
- `planetnik-runtime` has no volume mounts and no storage account exists in `planetnik-rg`.
- The runtime resolver only links named datasets from a datasets root with recognized Planetnik `data` directories.
- `alanpcurrie` works because a valid dataset is present in the repo image under `datasets/alanpcurrie/...`.
- `effect-ts` does not work because no valid `datasets/effect-ts/...` dataset is available in production.

## Planned changes

1. Add Azure Storage Account resources for hosted dataset storage.
2. Add an Azure Files share dedicated to Planetnik datasets.
3. Register the file share with the Container Apps Environment.
4. Mount the dataset share into `planetnik-runtime` at `/workspace/datasets`.
5. Set `PLANETNIK_DATASETS_ROOT=/workspace/datasets` on `planetnik-runtime`.
6. Add outputs/variables needed for the storage resources.
7. Add GitHub Actions dataset publishing so checked-in datasets sync to Azure Files automatically.
8. Validate the Terraform syntax and project typecheck after changes.

## Notes

- Checked-in datasets under `datasets/` now publish automatically to the Azure Files share via GitHub Actions.
- `effect-ts` still requires a codified CI source, because it is not currently present under `datasets/effect-ts/...` in the repo.
- `planetnik-app` does not need direct storage mounts for this fix.
