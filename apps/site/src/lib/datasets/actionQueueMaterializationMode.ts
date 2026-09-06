export const ACTION_QUEUE_DEFAULT_PARTITION_COUNT = 64

export type ActionQueueMaterializationMode = "bounded" | "complete"

/**
 * Selects the safe bounded prebuild unless the complete path is explicitly
 * requested with PLANETNIK_ACTION_QUEUE_COMPLETE=1.
 */
export function parseActionQueueMaterializationMode(value: string | undefined): ActionQueueMaterializationMode {
  const normalized = value?.trim().toLowerCase() ?? ""
  if (normalized === "" || normalized === "0" || normalized === "false") return "bounded"
  if (normalized === "1") return "complete"
  throw new Error("PLANETNIK_ACTION_QUEUE_COMPLETE must be unset, 0, false, or 1.")
}

/** Parses a decimal positive integer environment value without accepting lossy coercions. */
export function parseActionQueuePartitionCount(value: string | undefined): number {
  const normalized = value?.trim() ?? ""
  if (normalized === "") return ACTION_QUEUE_DEFAULT_PARTITION_COUNT
  if (!/^[1-9]\d*$/u.test(normalized)) throw new Error("PLANETNIK_ACTION_QUEUE_PARTITIONS must be a positive integer.")
  const parsed = Number(normalized)
  if (!Number.isSafeInteger(parsed) || parsed < 1)
    throw new Error("PLANETNIK_ACTION_QUEUE_PARTITIONS must be a positive integer.")
  return parsed
}
