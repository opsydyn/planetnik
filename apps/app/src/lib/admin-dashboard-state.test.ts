import { describe, expect, test } from "bun:test"
import { Registry } from "@effect-atom/atom-react"
import {
  ADMIN_DASHBOARD_TABLE_STATE_KEY,
  adminDashboardTableStateAtom,
  createDefaultAdminDashboardTableState,
} from "./admin-dashboard-state.js"

class MemoryStorage implements Storage {
  #store = new Map<string, string>()

  get length() {
    return this.#store.size
  }

  clear() {
    this.#store.clear()
  }

  getItem(key: string) {
    return this.#store.get(key) ?? null
  }

  key(index: number) {
    return [...this.#store.keys()][index] ?? null
  }

  removeItem(key: string) {
    this.#store.delete(key)
  }

  setItem(key: string, value: string) {
    this.#store.set(key, value)
  }
}

const storage = new MemoryStorage()

Object.defineProperty(globalThis, "localStorage", {
  value: storage,
  configurable: true,
})

describe("admin dashboard state", () => {
  test("persists table state across registries", () => {
    storage.clear()

    const firstRegistry = Registry.make()
    expect(firstRegistry.get(adminDashboardTableStateAtom)).toEqual(createDefaultAdminDashboardTableState())

    firstRegistry.set(adminDashboardTableStateAtom, {
      searchQuery: "ada",
      sorting: [{ id: "name", desc: false }],
      statusFilter: "banned",
      pageIndex: 2,
      pageSize: 50,
    })

    expect(storage.getItem(ADMIN_DASHBOARD_TABLE_STATE_KEY)).not.toBeNull()

    const secondRegistry = Registry.make()
    expect(secondRegistry.get(adminDashboardTableStateAtom)).toEqual({
      searchQuery: "ada",
      sorting: [{ id: "name", desc: false }],
      statusFilter: "banned",
      pageIndex: 2,
      pageSize: 50,
    })
  })
})
