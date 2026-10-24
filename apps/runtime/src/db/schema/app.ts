import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core"
import { user } from "./auth.js"

export const workspace = pgTable(
  "workspace",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
  },
  (table) => ({
    slugUnique: uniqueIndex("workspace_slug_unique").on(table.slug),
    ownerUserIdUnique: uniqueIndex("workspace_owner_user_id_unique").on(table.ownerUserId),
  }),
)

export const report = pgTable(
  "report",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    analysisRoot: text("analysis_root"),
    createdAt: timestamp("created_at").notNull(),
    updatedAt: timestamp("updated_at").notNull(),
    lastSyncedAt: timestamp("last_synced_at"),
  },
  (table) => ({
    workspaceSlugUnique: uniqueIndex("report_workspace_slug_unique").on(table.workspaceId, table.slug),
  }),
)
