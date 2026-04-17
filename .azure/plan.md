# Azure plan

Status: Applied and Automated

## Goal

Add production dataset storage for `planetnik-runtime` so report creation can resolve named datasets such as `alanpcurrie` under `/workspace/datasets/<name>/...`, matching the runtime resolver.

## Current findings

- `planetnik-runtime` and `planetnik-app` are deployed and networked correctly.
- `OPENAI_API_KEY` is deployed on `planetnik-runtime`.
- Hosted dataset storage now exists in `planetnik-rg` as `planetnikstge1289`.
- `planetnik-runtime` now mounts the Azure Files share as `datasets` at `/workspace/datasets`.
- `planetnik-runtime` now sets `PLANETNIK_DATASETS_ROOT=/workspace/datasets`.
- The runtime resolver only links named datasets from a datasets root with recognized Planetnik `data` directories.
- `alanpcurrie` is now the codified hosted landscape source via `landscape-config.json` and CI `analyzeLandscape` generation.
- Hosted landscape uploads now target `datasets/alanpcurrie/...` in Azure Files rather than relying on ignored local datasets.

## Completed changes

1. Add Azure Storage Account resources for hosted dataset storage.
2. Add an Azure Files share dedicated to Planetnik datasets.
3. Register the file share with the Container Apps Environment.
4. Mount the dataset share into `planetnik-runtime` at `/workspace/datasets`.
5. Set `PLANETNIK_DATASETS_ROOT=/workspace/datasets` on `planetnik-runtime`.
6. Add outputs/variables needed for the storage resources.
7. Add GitHub Actions dataset publishing so generated or checked-in datasets sync to Azure Files automatically.
8. Add CI generation for the `alanpcurrie` landscape dataset before Azure Files upload.
9. Validate the Terraform syntax, workflow behavior, and project typecheck after changes.

## Notes

- Checked-in datasets under `datasets/` still publish automatically to the Azure Files share via GitHub Actions.
- `alanpcurrie` is now generated in CI from `landscape-config.json` and uploaded to Azure Files without requiring manual dataset commits.
- The hosted dataset publish workflow also runs on a weekly schedule so external `alanpcurrie` repository changes can refresh the production landscape dataset.
- `planetnik-app` does not need direct storage mounts for this fix.
