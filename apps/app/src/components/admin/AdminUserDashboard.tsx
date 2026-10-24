import { useAtom } from "@effect/atom-react"
import {
  type ColumnDef,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  flexRender,
  type PaginationState,
  rowPaginationFeature,
  rowSortingFeature,
  type SortingState,
  sortFn_alphanumeric,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table"
import { type ComponentProps, useCallback, useEffect, useMemo, useRef } from "react"
import {
  type AdminEditableRole,
  type AdminPasswordDraft,
  type AdminUserDraft,
  type AdminUserRecord,
  buildCreateUserPayload,
  buildUpdateUserData,
  createAdminPasswordDraft,
  createAdminUserDraftFromUser,
  createEmptyAdminPasswordDraft,
  createEmptyAdminUserDraft,
  formatAdminDate,
  formatAdminUserRole,
  getAdminErrorMessage,
  matchesAdminUserFilters,
  normalizeAdminUser,
  validateAdminPasswordDraft,
  validateAdminUserDraft,
} from "../../lib/admin-dashboard.js"
import {
  ADMIN_DASHBOARD_PAGE_SIZE_OPTIONS,
  type AdminDashboardToast,
  adminDashboardTableStateAtom,
  adminEditorAtom,
  adminFeedbackAtom,
  adminPasswordAtom,
  adminToastsAtom,
  adminUsersAtom,
  createDefaultAdminDashboardTableState,
} from "../../lib/admin-dashboard-state.js"
import { authClient } from "../../lib/auth-client.js"

const features = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    datetime: sortFn_datetime,
    text: sortFn_text,
  },
})

type Props = {
  currentUserId: string
  currentUserRole: string
}

type FormSubmitHandler = NonNullable<ComponentProps<"form">["onSubmit"]>

function nextValue<T>(updater: T | ((current: T) => T), current: T): T {
  return typeof updater === "function" ? (updater as (value: T) => T)(current) : updater
}

function cloneSortingState(sorting: ReadonlyArray<{ id: string; desc: boolean }>): SortingState {
  return sorting.map((entry) => ({
    id: entry.id,
    desc: entry.desc,
  }))
}

function createToastId() {
  return `toast-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function SortHeader({
  label,
  sorted,
  onToggle,
}: {
  label: string
  sorted: false | "asc" | "desc"
  onToggle: () => void
}) {
  const indicator = sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"
  return (
    <button type="button" className="admin-table-sort" data-active={sorted ? "true" : "false"} onClick={onToggle}>
      <span>{label}</span>
      <span aria-hidden="true">{indicator}</span>
    </button>
  )
}

export default function AdminUserDashboard({ currentUserId, currentUserRole }: Props) {
  const didInitialLoad = useRef(false)
  const [users, setUsers] = useAtom(adminUsersAtom)
  const [tableState, setTableState] = useAtom(adminDashboardTableStateAtom)
  const [editor, setEditor] = useAtom(adminEditorAtom)
  const [passwordDraft, setPasswordDraft] = useAtom(adminPasswordAtom)
  const [feedback, setFeedback] = useAtom(adminFeedbackAtom)
  const [toasts, setToasts] = useAtom(adminToastsAtom)

  const { pageIndex, pageSize, searchQuery, sorting, statusFilter } = tableState
  const sortingState = useMemo(() => cloneSortingState(sorting), [sorting])

  const selectedUser = useMemo(
    () => users.find((user) => user.id === editor.selectedUserId) ?? null,
    [editor.selectedUserId, users],
  )

  const filteredUsers = useMemo(
    () => users.filter((user) => matchesAdminUserFilters(user, searchQuery, statusFilter)),
    [searchQuery, statusFilter, users],
  )

  const stats = useMemo(
    () => ({
      total: users.length,
      admins: users.filter((user) => formatAdminUserRole(user.role) === "admin").length,
      banned: users.filter((user) => user.banned).length,
      verified: users.filter((user) => user.emailVerified).length,
    }),
    [users],
  )

  const dismissToast = useCallback(
    (toastId: string) => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId))
    },
    [setToasts],
  )

  const pushToast = useCallback(
    (kind: AdminDashboardToast["kind"], message: string) => {
      const toast = { id: createToastId(), kind, message }
      setToasts((current) => [toast, ...current].slice(0, 4))
      return toast.id
    },
    [setToasts],
  )

  useEffect(() => {
    if (toasts.length === 0) {
      return
    }

    const timers = toasts.map((toast) =>
      window.setTimeout(
        () => dismissToast(toast.id),
        toast.kind === "error" ? 6000 : toast.kind === "info" ? 4500 : 3500,
      ),
    )

    return () => {
      timers.forEach((timer) => {
        window.clearTimeout(timer)
      })
    }
  }, [dismissToast, toasts])

  const upsertUser = useCallback(
    (nextUser: AdminUserRecord) => {
      setUsers((current) => {
        const nextUsers = [...current]
        const existingIndex = nextUsers.findIndex((user) => user.id === nextUser.id)

        if (existingIndex === -1) {
          nextUsers.unshift(nextUser)
          return nextUsers
        }

        nextUsers[existingIndex] = nextUser
        return nextUsers
      })
    },
    [setUsers],
  )

  const removeUserFromState = useCallback(
    (userId: string) => {
      setUsers((current) => current.filter((user) => user.id !== userId))
    },
    [setUsers],
  )

  const loadUsers = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}) => {
      if (!silent) {
        setFeedback((current) => ({
          ...current,
          loading: true,
          error: null,
        }))
      }

      const response = await authClient.admin.listUsers({
        query: {
          sortBy: "createdAt",
          sortDirection: "desc",
        },
      })

      if (response.error) {
        const message = getAdminErrorMessage(response.error, "Could not load users from the runtime.")

        if (!silent) {
          setUsers([])
        }

        setFeedback((current) => ({
          ...current,
          loading: false,
          error: message,
        }))

        if (silent) {
          pushToast("error", "Latest user data could not be refreshed.")
        }
        return
      }

      const nextUsers = (response.data?.users ?? []).map((user) => normalizeAdminUser(user))

      setUsers(nextUsers)
      setEditor((current) => {
        if (current.mode !== "edit" || !current.selectedUserId) {
          return current
        }

        const refreshedUser = nextUsers.find((user) => user.id === current.selectedUserId)
        if (!refreshedUser) {
          return {
            mode: "create",
            selectedUserId: null,
            draft: createEmptyAdminUserDraft(),
          }
        }

        return {
          mode: "edit",
          selectedUserId: refreshedUser.id,
          draft: createAdminUserDraftFromUser(refreshedUser),
        }
      })
      setPasswordDraft((current) => {
        if (!current.userId) {
          return current
        }

        const refreshedUser = nextUsers.find((user) => user.id === current.userId)
        return refreshedUser ? current : createEmptyAdminPasswordDraft()
      })
      setFeedback((current) => ({
        ...current,
        loading: false,
        error: null,
      }))
    },
    [pushToast, setEditor, setFeedback, setPasswordDraft, setUsers],
  )

  useEffect(() => {
    if (didInitialLoad.current) {
      return
    }

    didInitialLoad.current = true
    void loadUsers({ silent: users.length > 0 })
  }, [loadUsers, users.length])

  const handleSearchChange = (value: string) => {
    setTableState((current) => ({
      ...current,
      searchQuery: value,
      pageIndex: 0,
    }))
  }

  const handleStatusFilterChange = (value: typeof statusFilter) => {
    setTableState((current) => ({
      ...current,
      statusFilter: value,
      pageIndex: 0,
    }))
  }

  const handleSortingChange = (updater: SortingState | ((current: SortingState) => SortingState)) => {
    setTableState((current) => {
      const nextSorting = nextValue(updater, cloneSortingState(current.sorting))

      return {
        ...current,
        sorting: cloneSortingState(nextSorting),
        pageIndex: 0,
      }
    })
  }

  const handlePaginationChange = (updater: PaginationState | ((current: PaginationState) => PaginationState)) => {
    setTableState((current) => {
      const nextPagination = nextValue(updater, {
        pageIndex: current.pageIndex,
        pageSize: current.pageSize,
      })

      return {
        ...current,
        pageIndex: nextPagination.pageIndex,
        pageSize: nextPagination.pageSize,
      }
    })
  }

  const resetTableView = useCallback(() => {
    setTableState(createDefaultAdminDashboardTableState())
  }, [setTableState])

  const resetToCreateMode = useCallback(() => {
    setEditor({
      mode: "create",
      selectedUserId: null,
      draft: createEmptyAdminUserDraft(),
    })
    setFeedback((current) => ({
      ...current,
      error: null,
    }))
  }, [setEditor, setFeedback])

  const beginEdit = useCallback(
    (user: AdminUserRecord) => {
      setEditor({
        mode: "edit",
        selectedUserId: user.id,
        draft: createAdminUserDraftFromUser(user),
      })
      setFeedback((current) => ({
        ...current,
        error: null,
      }))
    },
    [setEditor, setFeedback],
  )

  const beginPasswordChange = useCallback(
    (user: AdminUserRecord) => {
      setPasswordDraft(createAdminPasswordDraft(user))
      setFeedback((current) => ({
        ...current,
        error: null,
      }))
    },
    [setFeedback, setPasswordDraft],
  )

  useEffect(() => {
    const maxPageIndex = Math.max(0, Math.ceil(filteredUsers.length / pageSize) - 1)

    if (pageIndex > maxPageIndex) {
      setTableState((current) => ({
        ...current,
        pageIndex: maxPageIndex,
      }))
    }
  }, [filteredUsers.length, pageIndex, pageSize, setTableState])

  const updateEditorField = <K extends keyof AdminUserDraft>(field: K, value: AdminUserDraft[K]) => {
    setEditor((current) => ({
      ...current,
      draft: {
        ...current.draft,
        [field]: value,
      },
    }))
  }

  const updatePasswordField = (field: keyof AdminPasswordDraft, value: string) => {
    setPasswordDraft((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const saveUser: FormSubmitHandler = async (event) => {
    event.preventDefault()
    const validationError = validateAdminUserDraft(editor.draft, editor.mode)
    if (validationError) {
      setFeedback((current) => ({
        ...current,
        error: validationError,
      }))
      return
    }

    if (editor.mode === "edit" && !selectedUser) {
      setFeedback((current) => ({
        ...current,
        error: "Select a user before editing.",
      }))
      return
    }

    setFeedback((current) => ({
      ...current,
      saving: true,
      busyLabel: editor.mode === "create" ? "Creating user..." : "Saving user...",
      error: null,
    }))

    if (editor.mode === "create") {
      const response = await authClient.admin.createUser(buildCreateUserPayload(editor.draft))

      if (response.error) {
        setFeedback((current) => ({
          ...current,
          saving: false,
          busyLabel: null,
          error: getAdminErrorMessage(response.error, "Could not create the user."),
        }))
        pushToast("error", "Could not create the user.")
        return
      }

      const createdUser = response.data?.user ? normalizeAdminUser(response.data.user) : null
      if (createdUser) {
        upsertUser(createdUser)
      }

      setTableState((current) => ({
        ...current,
        pageIndex: 0,
      }))
      resetToCreateMode()
      setFeedback((current) => ({
        ...current,
        saving: false,
        busyLabel: null,
      }))
      pushToast("success", `Created ${response.data?.user.name ?? "user"}.`)
      void loadUsers({ silent: true })
      return
    }

    const userToUpdate = selectedUser
    if (!userToUpdate) {
      setFeedback((current) => ({
        ...current,
        saving: false,
        busyLabel: null,
        error: "Select a user before editing.",
      }))
      return
    }

    const updateData = buildUpdateUserData(userToUpdate, editor.draft)
    if (Object.keys(updateData).length === 0) {
      setFeedback((current) => ({
        ...current,
        saving: false,
        busyLabel: null,
      }))
      pushToast("info", "No changes to save.")
      return
    }

    const response = await authClient.admin.updateUser({
      userId: userToUpdate.id,
      data: updateData,
    })

    if (response.error) {
      setFeedback((current) => ({
        ...current,
        saving: false,
        busyLabel: null,
        error: getAdminErrorMessage(response.error, "Could not update the user."),
      }))
      pushToast("error", "Could not update the user.")
      return
    }

    const updatedUser = response.data
      ? normalizeAdminUser(response.data)
      : normalizeAdminUser({
          ...userToUpdate,
          ...updateData,
          emailVerified: userToUpdate.emailVerified,
          banned: userToUpdate.banned,
          createdAt: userToUpdate.createdAt,
          updatedAt: new Date().toISOString(),
        })

    upsertUser(updatedUser)
    setFeedback((current) => ({
      ...current,
      saving: false,
      busyLabel: null,
    }))
    pushToast("success", `Updated ${editor.draft.name.trim()}.`)
    void loadUsers({ silent: true })
  }

  const savePassword: FormSubmitHandler = async (event) => {
    event.preventDefault()
    const validationError = validateAdminPasswordDraft(passwordDraft)
    if (validationError) {
      setFeedback((current) => ({
        ...current,
        error: validationError,
      }))
      return
    }

    setFeedback((current) => ({
      ...current,
      saving: true,
      busyLabel: "Updating password...",
      error: null,
    }))

    const userId = passwordDraft.userId
    if (!userId) {
      setFeedback((current) => ({
        ...current,
        saving: false,
        busyLabel: null,
        error: "Choose a user before changing a password.",
      }))
      return
    }

    const response = await authClient.admin.setUserPassword({
      userId,
      newPassword: passwordDraft.password.trim(),
    })

    if (response.error) {
      setFeedback((current) => ({
        ...current,
        saving: false,
        busyLabel: null,
        error: getAdminErrorMessage(response.error, "Could not update the user password."),
      }))
      pushToast("error", "Could not update the user password.")
      return
    }

    setPasswordDraft(createEmptyAdminPasswordDraft())
    setFeedback((current) => ({
      ...current,
      saving: false,
      busyLabel: null,
    }))
    pushToast("success", `Password updated for ${passwordDraft.userLabel}.`)
  }

  const deleteUser = useCallback(
    async (user: AdminUserRecord) => {
      if (user.id === currentUserId) {
        setFeedback((current) => ({
          ...current,
          error: "You cannot remove your own account from this dashboard.",
        }))
        return
      }

      if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) {
        return
      }

      setFeedback((current) => ({
        ...current,
        saving: true,
        busyLabel: "Deleting user...",
        error: null,
      }))

      const response = await authClient.admin.removeUser({ userId: user.id })
      if (response.error) {
        setFeedback((current) => ({
          ...current,
          saving: false,
          busyLabel: null,
          error: getAdminErrorMessage(response.error, "Could not remove the user."),
        }))
        pushToast("error", "Could not remove the user.")
        return
      }

      removeUserFromState(user.id)
      if (editor.selectedUserId === user.id) {
        resetToCreateMode()
      }
      if (passwordDraft.userId === user.id) {
        setPasswordDraft(createEmptyAdminPasswordDraft())
      }
      setFeedback((current) => ({
        ...current,
        saving: false,
        busyLabel: null,
      }))
      pushToast("success", `Deleted ${user.name}.`)
      void loadUsers({ silent: true })
    },
    [
      currentUserId,
      editor.selectedUserId,
      loadUsers,
      passwordDraft.userId,
      pushToast,
      removeUserFromState,
      resetToCreateMode,
      setFeedback,
      setPasswordDraft,
    ],
  )

  const toggleUserBan = useCallback(
    async (user: AdminUserRecord) => {
      if (user.id === currentUserId) {
        setFeedback((current) => ({
          ...current,
          error: "You cannot change your own ban state from this dashboard.",
        }))
        return
      }

      const actionLabel = user.banned ? "unban" : "ban"
      const confirmed = window.confirm(
        user.banned
          ? `Unban ${user.email} and restore access?`
          : `Ban ${user.email}? Existing sessions will be revoked.`,
      )

      if (!confirmed) {
        return
      }

      setFeedback((current) => ({
        ...current,
        saving: true,
        busyLabel: user.banned ? "Unbanning user..." : "Banning user...",
        error: null,
      }))

      const response = user.banned
        ? await authClient.admin.unbanUser({ userId: user.id })
        : await authClient.admin.banUser({
            userId: user.id,
            banReason: "Suspended by admin dashboard",
          })

      if (response.error) {
        setFeedback((current) => ({
          ...current,
          saving: false,
          busyLabel: null,
          error: getAdminErrorMessage(response.error, `Could not ${actionLabel} the user.`),
        }))
        pushToast("error", `Could not ${actionLabel} ${user.name}.`)
        return
      }

      const updatedUser = response.data?.user
        ? normalizeAdminUser(response.data.user)
        : normalizeAdminUser({
            ...user,
            banned: !user.banned,
            updatedAt: new Date().toISOString(),
          })

      upsertUser(updatedUser)
      setFeedback((current) => ({
        ...current,
        saving: false,
        busyLabel: null,
      }))
      pushToast("success", `${user.banned ? "Unbanned" : "Banned"} ${user.name}.`)
      void loadUsers({ silent: true })
    },
    [currentUserId, loadUsers, pushToast, setFeedback, upsertUser],
  )

  const impersonateUser = useCallback(
    async (user: AdminUserRecord) => {
      if (user.id === currentUserId) {
        setFeedback((current) => ({
          ...current,
          error: "You are already you. The dashboard applauds your consistency.",
        }))
        return
      }

      if (
        !window.confirm(
          `Impersonate ${user.email}? You will leave the admin dashboard and continue as that user until you sign out or stop impersonating.`,
        )
      ) {
        return
      }

      setFeedback((current) => ({
        ...current,
        saving: true,
        busyLabel: `Impersonating ${user.name}...`,
        error: null,
      }))

      const response = await authClient.admin.impersonateUser({ userId: user.id })
      if (response.error) {
        setFeedback((current) => ({
          ...current,
          saving: false,
          busyLabel: null,
          error: getAdminErrorMessage(response.error, "Could not start impersonation."),
        }))
        pushToast("error", `Could not impersonate ${user.name}.`)
        return
      }

      window.location.assign("/")
    },
    [currentUserId, pushToast, setFeedback],
  )

  const columns = useMemo<ColumnDef<typeof features, AdminUserRecord>[]>(
    () => [
      {
        id: "name",
        accessorFn: (user) => user.name,
        header: ({ column }) => (
          <SortHeader
            label="User"
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => {
          const user = row.original
          return (
            <div>
              <div className="table-primary">
                {user.name}
                {user.id === currentUserId ? " (you)" : ""}
              </div>
              <div className="table-secondary">{user.email}</div>
            </div>
          )
        },
      },
      {
        id: "role",
        accessorFn: (user) => formatAdminUserRole(user.role),
        header: ({ column }) => (
          <SortHeader
            label="Role"
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => formatAdminUserRole(row.original.role),
      },
      {
        id: "verified",
        accessorFn: (user) => (user.banned ? "Banned" : user.emailVerified ? "Verified" : "Pending verification"),
        header: ({ column }) => (
          <SortHeader
            label="Status"
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => (
          <div>
            <div
              className="admin-status-badge"
              data-kind={row.original.banned ? "banned" : row.original.emailVerified ? "verified" : "pending"}
            >
              {row.original.banned ? "Banned" : row.original.emailVerified ? "Verified" : "Pending verification"}
            </div>
            <div className="table-secondary">
              {row.original.banned
                ? row.original.emailVerified
                  ? "Email verified before suspension"
                  : "Awaiting verification and suspended"
                : row.original.emailVerified
                  ? "Email verified"
                  : "Awaiting verification"}
            </div>
          </div>
        ),
      },
      {
        id: "createdAt",
        accessorFn: (user) => user.createdAt,
        header: ({ column }) => (
          <SortHeader
            label="Created"
            sorted={column.getIsSorted()}
            onToggle={() => column.toggleSorting(column.getIsSorted() === "asc")}
          />
        ),
        cell: ({ row }) => formatAdminDate(row.original.createdAt),
      },
      {
        id: "actions",
        enableSorting: false,
        header: () => <span>Actions</span>,
        cell: ({ row }) => {
          const user = row.original
          return (
            <div className="admin-inline-actions">
              <button type="button" className="button-secondary button-small" onClick={() => beginEdit(user)}>
                Edit
              </button>
              <button type="button" className="button-secondary button-small" onClick={() => beginPasswordChange(user)}>
                Password
              </button>
              <button
                type="button"
                className="button-secondary button-small"
                onClick={() => void toggleUserBan(user)}
                disabled={feedback.saving || user.id === currentUserId}
              >
                {user.banned ? "Unban" : "Ban"}
              </button>
              <button
                type="button"
                className="button-secondary button-small"
                onClick={() => void impersonateUser(user)}
                disabled={feedback.saving || user.id === currentUserId || user.banned}
              >
                Impersonate
              </button>
              <button
                type="button"
                className="button-secondary button-small button-danger"
                onClick={() => void deleteUser(user)}
                disabled={feedback.saving || user.id === currentUserId}
              >
                Delete
              </button>
            </div>
          )
        },
      },
    ],
    [beginEdit, beginPasswordChange, currentUserId, deleteUser, feedback.saving, impersonateUser, toggleUserBan],
  )

  const table = useTable({
    features,
    data: filteredUsers,
    columns,
    state: {
      sorting: sortingState,
      pagination: {
        pageIndex,
        pageSize,
      },
    },
    onSortingChange: handleSortingChange,
    onPaginationChange: handlePaginationChange,
  })

  const visibleRowCount = table.getRowModel().rows.length
  const filteredCount = filteredUsers.length
  const rangeStart = filteredCount === 0 ? 0 : pageIndex * pageSize + 1
  const rangeEnd = filteredCount === 0 ? 0 : Math.min(filteredCount, pageIndex * pageSize + visibleRowCount)

  return (
    <div className="dashboard-stack">
      {toasts.length > 0 ? (
        <div className="admin-toast-region" aria-live="polite" aria-atomic="false">
          {toasts.map((toast) => (
            <section key={toast.id} className="admin-toast" data-kind={toast.kind}>
              <div className="admin-toast-copy">
                <strong>{toast.kind === "success" ? "Done" : toast.kind === "error" ? "Heads up" : "Update"}</strong>
                <span>{toast.message}</span>
              </div>
              <button type="button" className="admin-toast-dismiss" onClick={() => dismissToast(toast.id)}>
                Dismiss
              </button>
            </section>
          ))}
        </div>
      ) : null}

      <section className="callout">
        <strong>Admin dashboard ready.</strong>
        <span>
          Manage hosted users with Better Auth-backed CRUD flows, ban and impersonation controls, persistent table
          preferences, and optimistic background refreshes. Signed in as <code>{currentUserRole}</code>.
        </span>
      </section>

      {feedback.error ? <section className="form-error">{feedback.error}</section> : null}

      <section className="admin-dashboard-grid">
        <article className="dashboard-card dashboard-card-primary">
          <p className="card-kicker">Overview</p>
          <h2>User administration</h2>
          <p>
            Create accounts, update user details, suspend or restore access, impersonate safely, and keep the table in
            sync without giving up your current view.
          </p>
          <div className="admin-summary-grid">
            <div className="admin-stat">
              <span className="admin-stat-label">Total users</span>
              <strong className="admin-stat-value">{stats.total}</strong>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Admins</span>
              <strong className="admin-stat-value">{stats.admins}</strong>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Banned</span>
              <strong className="admin-stat-value">{stats.banned}</strong>
            </div>
            <div className="admin-stat">
              <span className="admin-stat-label">Verified</span>
              <strong className="admin-stat-value">{stats.verified}</strong>
            </div>
          </div>
          <div className="card-actions">
            <button type="button" className="button" onClick={resetToCreateMode}>
              Create user
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => void loadUsers()}
              disabled={feedback.loading || feedback.saving}
            >
              Refresh
            </button>
            <button type="button" className="button-secondary" onClick={resetTableView} disabled={feedback.saving}>
              Reset view
            </button>
          </div>
        </article>

        <article className="dashboard-card">
          <p className="card-kicker">{editor.mode === "create" ? "Create" : "Edit"}</p>
          <h2>{editor.mode === "create" ? "Create user" : `Edit ${selectedUser?.name ?? "user"}`}</h2>
          <p>
            {editor.mode === "create"
              ? "New users are created through the runtime admin plugin and appear in the table immediately while the dashboard quietly reconciles in the background."
              : "Update the selected user's core details. Password changes stay separate so you can be a little less terrifying."}
          </p>
          <form className="report-form" onSubmit={(event) => void saveUser(event)}>
            <div className="admin-form-grid">
              <div className="field">
                <label htmlFor="admin-user-name">Name</label>
                <input
                  id="admin-user-name"
                  type="text"
                  value={editor.draft.name}
                  onChange={(event) => updateEditorField("name", event.target.value)}
                  placeholder="Ada Lovelace"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="admin-user-role">Role</label>
                <select
                  id="admin-user-role"
                  value={editor.draft.role}
                  onChange={(event) => updateEditorField("role", event.target.value as AdminEditableRole)}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <div className="field admin-form-full">
                <label htmlFor="admin-user-email">Email</label>
                <input
                  id="admin-user-email"
                  type="email"
                  value={editor.draft.email}
                  onChange={(event) => updateEditorField("email", event.target.value)}
                  placeholder="ada@planetnik.dev"
                  required
                />
              </div>
              {editor.mode === "create" ? (
                <div className="field admin-form-full">
                  <label htmlFor="admin-user-password">Initial password</label>
                  <input
                    id="admin-user-password"
                    type="password"
                    value={editor.draft.password}
                    onChange={(event) => updateEditorField("password", event.target.value)}
                    placeholder="Minimum 8 characters"
                    required
                  />
                </div>
              ) : null}
            </div>
            <div className="card-actions">
              <button className="button" type="submit" disabled={feedback.saving}>
                {feedback.saving
                  ? (feedback.busyLabel ?? "Saving...")
                  : editor.mode === "create"
                    ? "Create user"
                    : "Save changes"}
              </button>
              {editor.mode === "edit" ? (
                <button type="button" className="button-secondary" onClick={resetToCreateMode}>
                  Cancel edit
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="dashboard-card">
          <p className="card-kicker">Password</p>
          <h2>{passwordDraft.userId ? `Change password for ${passwordDraft.userLabel}` : "Select a user password"}</h2>
          <p>
            {passwordDraft.userId
              ? "Set a new credential password through Better Auth's admin endpoint. This one stays intentionally separate from the profile edit flow."
              : "Use the Password action in the table to select a user for a password change."}
          </p>
          <form className="report-form" onSubmit={(event) => void savePassword(event)}>
            <div className="admin-form-grid">
              <div className="field admin-form-full">
                <label htmlFor="admin-password">New password</label>
                <input
                  id="admin-password"
                  type="password"
                  value={passwordDraft.password}
                  onChange={(event) => updatePasswordField("password", event.target.value)}
                  placeholder="Minimum 8 characters"
                  disabled={!passwordDraft.userId}
                />
              </div>
              <div className="field admin-form-full">
                <label htmlFor="admin-password-confirm">Confirm password</label>
                <input
                  id="admin-password-confirm"
                  type="password"
                  value={passwordDraft.confirmPassword}
                  onChange={(event) => updatePasswordField("confirmPassword", event.target.value)}
                  placeholder="Repeat new password"
                  disabled={!passwordDraft.userId}
                />
              </div>
            </div>
            <div className="card-actions">
              <button className="button" type="submit" disabled={!passwordDraft.userId || feedback.saving}>
                {feedback.saving && feedback.busyLabel ? feedback.busyLabel : "Update password"}
              </button>
              {passwordDraft.userId ? (
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setPasswordDraft(createEmptyAdminPasswordDraft())}
                >
                  Clear
                </button>
              ) : null}
            </div>
          </form>
        </article>

        <article className="dashboard-card admin-card-full">
          <div className="admin-toolbar">
            <div>
              <p className="card-kicker">Users</p>
              <h2>Manage users</h2>
              <p className="muted-copy">
                Sort by any major column, search by name, email, or role, filter to active or banned users, and keep
                your table state across navigation.
              </p>
            </div>
            <div className="admin-toolbar-controls">
              <div className="field admin-filter-field">
                <label htmlFor="admin-user-status-filter">Status</label>
                <select
                  id="admin-user-status-filter"
                  value={statusFilter}
                  onChange={(event) => handleStatusFilterChange(event.target.value as typeof statusFilter)}
                >
                  <option value="all">All users</option>
                  <option value="active">Active only</option>
                  <option value="banned">Banned only</option>
                </select>
              </div>
              <div className="field admin-search-field">
                <label htmlFor="admin-user-search">Search users</label>
                <input
                  id="admin-user-search"
                  type="search"
                  value={searchQuery}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="Search by name, email, or role"
                />
              </div>
            </div>
          </div>

          {feedback.loading ? (
            <p className="muted-copy">Loading users…</p>
          ) : table.getRowModel().rows.length > 0 ? (
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  {table.getHeaderGroups().map((headerGroup) => (
                    <tr key={headerGroup.id}>
                      {headerGroup.headers.map((header) => (
                        <th key={header.id}>
                          {header.isPlaceholder
                            ? null
                            : flexRender(header.column.columnDef.header, header.getContext())}
                        </th>
                      ))}
                    </tr>
                  ))}
                </thead>
                <tbody>
                  {table.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      className={row.original.id === editor.selectedUserId ? "admin-users-row-active" : undefined}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="admin-empty-state">No users match the current filter.</div>
          )}

          <div className="admin-pagination">
            <div className="admin-pagination-summary">
              Showing <strong>{rangeStart}</strong>-<strong>{rangeEnd}</strong> of <strong>{filteredCount}</strong>
              {filteredCount === users.length ? " users" : ` filtered users from ${users.length} total`}
            </div>
            <div className="admin-pagination-controls">
              <div className="field admin-page-size-field">
                <label htmlFor="admin-page-size">Rows per page</label>
                <select
                  id="admin-page-size"
                  value={pageSize}
                  onChange={(event) =>
                    handlePaginationChange({
                      pageIndex: 0,
                      pageSize: Number(event.target.value),
                    })
                  }
                >
                  {ADMIN_DASHBOARD_PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
              <div className="admin-pagination-actions">
                <button
                  type="button"
                  className="button-secondary button-small"
                  onClick={() => table.setPageIndex(0)}
                  disabled={!table.getCanPreviousPage()}
                >
                  First
                </button>
                <button
                  type="button"
                  className="button-secondary button-small"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  Previous
                </button>
                <span className="admin-pagination-page-label">
                  Page <strong>{table.getPageCount() === 0 ? 0 : pageIndex + 1}</strong> of{" "}
                  <strong>{table.getPageCount()}</strong>
                </span>
                <button
                  type="button"
                  className="button-secondary button-small"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  Next
                </button>
                <button
                  type="button"
                  className="button-secondary button-small"
                  onClick={() => table.setPageIndex(Math.max(0, table.getPageCount() - 1))}
                  disabled={!table.getCanNextPage()}
                >
                  Last
                </button>
              </div>
            </div>
          </div>
        </article>
      </section>
    </div>
  )
}
