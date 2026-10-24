import { BrowserKeyValueStore } from "@effect/platform-browser"
import type { SortingState } from "@tanstack/react-table"
import { Schema } from "effect"
import { Atom } from "effect/reactivity"
import {
  type AdminPasswordDraft,
  type AdminUserDraft,
  type AdminUserRecord,
  type AdminUserStatusFilter,
  createEmptyAdminPasswordDraft,
  createEmptyAdminUserDraft,
} from "./admin-dashboard.js"

export type AdminDashboardEditorState = {
  mode: "create" | "edit"
  selectedUserId: string | null
  draft: AdminUserDraft
}

export type AdminDashboardFeedbackState = {
  loading: boolean
  saving: boolean
  busyLabel: string | null
  error: string | null
}

export type AdminDashboardToast = {
  id: string
  kind: "success" | "error" | "info"
  message: string
}

export type AdminDashboardTableState = {
  searchQuery: string
  sorting: SortingState
  statusFilter: AdminUserStatusFilter
  pageIndex: number
  pageSize: number
}

export const ADMIN_DASHBOARD_TABLE_STATE_KEY = "planetnik.adminDashboard.tableState"
export const ADMIN_DASHBOARD_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const

const localStorageRuntime = Atom.runtime(BrowserKeyValueStore.layerLocalStorage)

const sortingSchema = Schema.Array(
  Schema.Struct({
    id: Schema.String,
    desc: Schema.Boolean,
  }),
)

const tableStateSchema = Schema.Struct({
  searchQuery: Schema.String,
  sorting: sortingSchema,
  statusFilter: Schema.Literals(["all", "active", "banned"]),
  pageIndex: Schema.Number,
  pageSize: Schema.Number,
})

const defaultSortingState = (): SortingState => [{ id: "createdAt", desc: true }]

export const createDefaultAdminDashboardTableState = (): AdminDashboardTableState => ({
  searchQuery: "",
  sorting: defaultSortingState(),
  statusFilter: "all",
  pageIndex: 0,
  pageSize: 25,
})

const defaultFeedbackState = (): AdminDashboardFeedbackState => ({
  loading: true,
  saving: false,
  busyLabel: null,
  error: null,
})

export const adminDashboardTableStateAtom = Atom.withServerValue(
  Atom.kvs({
    runtime: localStorageRuntime,
    key: ADMIN_DASHBOARD_TABLE_STATE_KEY,
    schema: tableStateSchema,
    defaultValue: createDefaultAdminDashboardTableState,
  }),
  createDefaultAdminDashboardTableState,
)

export const adminUsersAtom = Atom.make<AdminUserRecord[]>([])
export const adminEditorAtom = Atom.make<AdminDashboardEditorState>({
  mode: "create",
  selectedUserId: null,
  draft: createEmptyAdminUserDraft(),
})
export const adminPasswordAtom = Atom.make<AdminPasswordDraft>(createEmptyAdminPasswordDraft())
export const adminFeedbackAtom = Atom.make<AdminDashboardFeedbackState>(defaultFeedbackState())
export const adminToastsAtom = Atom.make<AdminDashboardToast[]>([])
