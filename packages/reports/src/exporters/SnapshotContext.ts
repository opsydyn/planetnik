import { randomUUID } from "node:crypto"

export type SnapshotExportContext = Readonly<{
  snapshotId: string
  generatedAt: string
}>

export function createSnapshotExportContext(): SnapshotExportContext {
  return {
    snapshotId: randomUUID(),
    generatedAt: new Date().toISOString(),
  }
}
