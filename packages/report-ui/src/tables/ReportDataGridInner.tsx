import {
	type ColumnDef,
	type ColumnFiltersState,
	type OnChangeFn,
	type PaginationState,
	flexRender,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	type SortingState,
	useReactTable,
} from "@tanstack/react-table";
import {
	startTransition,
	useDeferredValue,
	useEffect,
	useId,
	useMemo,
	useState,
} from "react";
import type {
	GridCellValue,
	GridColumnConfig,
	GridRow,
	ReportDataGridProps,
} from "./ReportDataGrid.types";
import { formatReportDate, normalizeReportDate } from "../utils/reportDates.js";

function normalizeSearchValue(value: unknown): string {
	return value == null ? "" : String(value).toLowerCase().trim();
}

function formatNumber(value: GridCellValue): string {
	return typeof value === "number"
		? value.toLocaleString()
		: value == null
			? "—"
			: String(value);
}

function formatSearchTextValue(value: unknown): string {
	return value == null ? "" : String(value);
}

function normalizeDateCellValue(value: GridCellValue): string {
	return normalizeReportDate(typeof value === "boolean" ? null : value);
}

function formatDateCellValue(value: GridCellValue): string {
	return formatReportDate(typeof value === "boolean" ? null : value);
}

function getStatusTone(value: GridCellValue): string {
	const normalized = String(value ?? "").toLowerCase();

	if (
		normalized.includes("critical") ||
		normalized.includes("known exploited") ||
		normalized.includes("overdue")
	) {
		return "critical";
	}

	if (
		normalized.includes("high") ||
		normalized.includes("open") ||
		normalized.includes("stale")
	) {
		return "warning";
	}

	if (
		normalized.includes("medium") ||
		normalized.includes("watch") ||
		normalized.includes("active")
	) {
		return "info";
	}

	if (
		normalized.includes("low") ||
		normalized.includes("clear") ||
		normalized.includes("fixed") ||
		normalized.includes("healthy")
	) {
		return "healthy";
	}

	return "neutral";
}

function getColumnSearchText(row: GridRow, column: GridColumnConfig): string {
	const values = [
		(column.type ?? "text") === "date"
			? normalizeDateCellValue(row[column.field])
			: formatSearchTextValue(row[column.field]),
	];

	if (column.secondaryField) {
		values.push(formatSearchTextValue(row[column.secondaryField]));
	}

	if (column.tooltipField) {
		values.push(formatSearchTextValue(row[column.tooltipField]));
	}

	return values
		.filter((value) => value !== "")
		.join(" ")
		.toLowerCase();
}

function getGlobalSearchText(
	row: GridRow,
	columns: ReadonlyArray<GridColumnConfig>,
): string {
	return columns.map((column) => getColumnSearchText(row, column)).join(" ");
}

function compareValues(left: GridCellValue, right: GridCellValue): number {
	if (left == null && right == null) return 0;
	if (left == null) return 1;
	if (right == null) return -1;

	if (typeof left === "number" && typeof right === "number") {
		return left - right;
	}

	return String(left).localeCompare(String(right), undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function compareDateValues(left: GridCellValue, right: GridCellValue): number {
	const normalizedLeft = normalizeDateCellValue(left);
	const normalizedRight = normalizeDateCellValue(right);

	if (!normalizedLeft && !normalizedRight) return 0;
	if (!normalizedLeft) return 1;
	if (!normalizedRight) return -1;

	return normalizedLeft.localeCompare(normalizedRight, undefined, {
		numeric: true,
		sensitivity: "base",
	});
}

function renderCellValue(column: GridColumnConfig, row: GridRow) {
	const value = row[column.field];
	const type = column.type ?? "text";

	if (type === "link") {
		const label = value == null ? "—" : String(value);
		const href = column.hrefField ? row[column.hrefField] : null;
		const secondary = column.secondaryField ? row[column.secondaryField] : null;

		return (
			<div className="report-grid__link-wrap">
				{typeof href === "string" && href ? (
					<a className="report-grid__link" href={href}>
						{label}
					</a>
				) : (
					<span className="report-grid__link-fallback">{label}</span>
				)}
				{secondary ? (
					<div className="report-grid__secondary">{String(secondary)}</div>
				) : null}
			</div>
		);
	}

	if (type === "code") {
		return <code className="report-grid__code">{value == null ? "—" : String(value)}</code>;
	}

	if (type === "status") {
		const content = value == null ? "—" : String(value);
		return (
			<span className={`report-grid__status report-grid__status--${getStatusTone(value)}`}>
				{content}
			</span>
		);
	}

	if (type === "path") {
		const content = value == null ? "—" : String(value);
		return (
			<span className="report-grid__path" title={content}>
				{content}
			</span>
		);
	}

	if (type === "multiline") {
		const content = value == null ? "—" : String(value);
		return (
			<div className="report-grid__multiline-value" title={content}>
				{content}
			</div>
		);
	}

	if (type === "number") return formatNumber(value);

	if (type === "percent") {
		if (typeof value === "number") {
			return `${value.toLocaleString()}%`;
		}
		return value == null ? "—" : String(value);
	}

	if (type === "date") return formatDateCellValue(value);

	return value == null ? "—" : String(value);
}

function getCellClassName(column: GridColumnConfig): string {
	const type = column.type ?? "text";
	if (type === "number" || type === "percent") return "report-grid__num";
	if (type === "date") return "report-grid__date";
	if (type === "path") return "report-grid__path-cell";
	if (type === "multiline") return "report-grid__multiline";
	if (type === "status") return "report-grid__status-cell";
	return "";
}

function getRowClassName(row: GridRow): string | undefined {
	const rowTone = row.rowTone;

	if (typeof rowTone === "string" && rowTone) {
		return `report-grid__row report-grid__row--${rowTone}`;
	}

	return undefined;
}

function getColumnStyle(column: GridColumnConfig) {
	return {
		minWidth: `${column.minWidth ?? 140}px`,
		width: `${column.minWidth ?? 140}px`,
	};
}

function createColumnDef(column: GridColumnConfig): ColumnDef<GridRow> {
	return {
		id: column.field,
		accessorFn: (row) => row[column.field],
		header: column.headerName,
		enableSorting: true,
		enableColumnFilter: true,
		sortingFn: (left, right) =>
			(column.type ?? "text") === "date"
				? compareDateValues(left.original[column.field], right.original[column.field])
				: compareValues(left.original[column.field], right.original[column.field]),
		filterFn: (row, _columnId, filterValue) => {
			const normalizedFilter = normalizeSearchValue(filterValue);
			if (!normalizedFilter) return true;
			return getColumnSearchText(row.original, column).includes(normalizedFilter);
		},
		cell: ({ row }) => renderCellValue(column, row.original),
		meta: {
			config: column,
		},
	};
}

function getColumnMetaConfig(
	columnDef: ColumnDef<GridRow>,
): GridColumnConfig | undefined {
	return (columnDef.meta as { config?: GridColumnConfig } | undefined)?.config;
}

export default function ReportDataGridInner({
	title,
	description,
	searchPlaceholder = "Search rows",
	searchHint,
	emptyMessage = "No rows available.",
	rows,
	columns,
	paginationPageSize = 25,
	searchEnabled = true,
}: ReportDataGridProps) {
	const [query, setQuery] = useState("");
	const deferredQuery = useDeferredValue(query);
	const [showFilters, setShowFilters] = useState(false);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const initialSorting = useMemo<SortingState>(
		() =>
			columns
				.filter((column) => column.sort)
				.map((column) => ({ id: column.field, desc: column.sort === "desc" })),
		[columns],
	);
	const [sorting, setSorting] = useState<SortingState>(initialSorting);
	const [pagination, setPagination] = useState<PaginationState>({
		pageIndex: 0,
		pageSize: paginationPageSize,
	});
	const searchInputId = useId();

	useEffect(() => {
		setSorting(initialSorting);
	}, [initialSorting]);

	useEffect(() => {
		setPagination((current) =>
			current.pageIndex === 0 && current.pageSize === paginationPageSize
				? current
				: {
					pageIndex: 0,
					pageSize: paginationPageSize || current.pageSize,
				},
		);
	}, [paginationPageSize]);

	useEffect(() => {
		setPagination((current) =>
			current.pageIndex === 0 ? current : { ...current, pageIndex: 0 },
		);
	}, [columnFilters, deferredQuery]);

	const searchedRows = useMemo(() => {
		const normalizedQuery = normalizeSearchValue(deferredQuery);
		if (!searchEnabled || !normalizedQuery) return Array.from(rows);

		return rows.filter((row) =>
			getGlobalSearchText(row, columns).includes(normalizedQuery),
		);
	}, [columns, deferredQuery, rows, searchEnabled]);

	const columnDefs = useMemo<ColumnDef<GridRow>[]>(
		() => columns.map(createColumnDef),
		[columns],
	);

	const handlePaginationChange: OnChangeFn<PaginationState> = (updater) => {
		setPagination((current) =>
			typeof updater === "function" ? updater(current) : updater,
		);
	};

	const table = useReactTable<GridRow>({
		data: searchedRows,
		columns: columnDefs,
		state: {
			sorting,
			columnFilters,
			pagination,
		},
		autoResetPageIndex: false,
		onSortingChange: setSorting,
		onColumnFiltersChange: setColumnFilters,
		onPaginationChange: handlePaginationChange,
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
	});

	const filteredRowCount = table.getFilteredRowModel().rows.length;
	const pageRows = table.getRowModel().rows;
	const pageCount = Math.max(table.getPageCount(), 1);
	const pageIndex = table.getState().pagination.pageIndex;
	const pageSize = table.getState().pagination.pageSize;
	const fromRow = filteredRowCount === 0 ? 0 : pageIndex * pageSize + 1;
	const toRow =
		filteredRowCount === 0
			? 0
			: Math.min((pageIndex + 1) * pageSize, filteredRowCount);
	const pageSizeOptions = [...new Set([10, 25, 50, 100, paginationPageSize])].sort(
		(a, b) => a - b,
	);

	useEffect(() => {
		const maxPageIndex = Math.max(0, Math.ceil(filteredRowCount / pageSize) - 1);

		setPagination((current) =>
			current.pageIndex > maxPageIndex
				? { ...current, pageIndex: maxPageIndex }
				: current,
		);
	}, [filteredRowCount, pageSize]);

	return (
		<section className="report-grid-panel">
			{title || description || searchEnabled ? (
				<div className="report-grid-panel__toolbar">
					<div className="report-grid-panel__copy">
						{title ? <h3>{title}</h3> : null}
						{description ? <p>{description}</p> : null}
					</div>
					<div className="report-grid-panel__controls">
						{searchEnabled ? (
							<label className="report-grid-panel__search" htmlFor={searchInputId}>
								<span>Search rows</span>
								<input
									id={searchInputId}
									type="search"
									value={query}
									placeholder={searchPlaceholder}
									onChange={(event) =>
										startTransition(() => {
											setQuery(event.target.value);
										})
									}
								/>
							</label>
						) : null}
						<button
							type="button"
							className="report-grid-panel__toggle"
							onClick={() => setShowFilters((current) => !current)}
							aria-pressed={showFilters}
						>
							{showFilters ? "Hide filters" : "Column filters"}
						</button>
						<div className="report-grid-panel__count">
							{filteredRowCount.toLocaleString()} rows
						</div>
					</div>
				</div>
			) : null}

			{searchHint ? <p className="report-grid-panel__hint">{searchHint}</p> : null}

			{rows.length === 0 ? (
				<div className="report-grid-panel__empty">{emptyMessage}</div>
			) : (
				<div className="report-grid-panel__surface">
					<div className="report-grid-panel__table-wrap">
						<table className="report-grid-table">
							<thead>
								{table.getHeaderGroups().map((headerGroup) => (
									<tr key={headerGroup.id}>
										{headerGroup.headers.map((header) => {
											const column = getColumnMetaConfig(header.column.columnDef);
											return (
												<th
													key={header.id}
													style={column ? getColumnStyle(column) : undefined}
												>
													{header.isPlaceholder ? null : (
														<button
															type="button"
															className="report-grid-table__sort"
															onClick={header.column.getToggleSortingHandler()}
														>
															<span>
																{flexRender(
																	header.column.columnDef.header,
																	header.getContext(),
																)}
															</span>
															<span
																className="report-grid-table__sort-indicator"
																aria-hidden="true"
															>
																{header.column.getIsSorted() === "asc"
																	? "↑"
																	: header.column.getIsSorted() === "desc"
																		? "↓"
																		: "↕"}
															</span>
														</button>
													)}
												</th>
											);
										})}
									</tr>
								))}
								{showFilters ? (
									<tr className="report-grid-table__filters">
										{table.getAllLeafColumns().map((column) => {
											const config = getColumnMetaConfig(column.columnDef);
											return (
												<th
													key={`${column.id}-filter`}
													style={config ? getColumnStyle(config) : undefined}
												>
													<input
														type="search"
														value={String(column.getFilterValue() ?? "")}
														placeholder={
															config
																? `Filter ${config.headerName.toLowerCase()}`
																: "Filter"
														}
														onChange={(event) =>
															startTransition(() => {
																column.setFilterValue(
																	event.target.value || undefined,
																);
															})
														}
													/>
												</th>
											);
										})}
									</tr>
								) : null}
							</thead>
							<tbody>
								{pageRows.length > 0 ? (
									pageRows.map((row) => (
										<tr key={row.id} className={getRowClassName(row.original)}>
											{row.getVisibleCells().map((cell) => {
												const config = getColumnMetaConfig(cell.column.columnDef);
												return (
													<td
														key={cell.id}
														style={config ? getColumnStyle(config) : undefined}
														className={config ? getCellClassName(config) : undefined}
													>
														{flexRender(cell.column.columnDef.cell, cell.getContext())}
													</td>
												);
											})}
										</tr>
									))
								) : (
									<tr>
										<td className="report-grid-table__empty" colSpan={columns.length}>
											{emptyMessage}
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>

					<div className="report-grid-footer">
						<div className="report-grid-footer__meta">
							{fromRow.toLocaleString()} to {toRow.toLocaleString()} of{" "}
							{filteredRowCount.toLocaleString()}. Page{" "}
							{(pageIndex + 1).toLocaleString()} of {pageCount.toLocaleString()}
						</div>
						<div className="report-grid-footer__controls">
							<label className="report-grid-footer__page-size">
								<span>Rows</span>
								<select
									value={pageSize}
									onChange={(event) =>
										startTransition(() => {
											table.setPageSize(Number(event.target.value));
										})
									}
								>
									{pageSizeOptions.map((option) => (
										<option key={option} value={option}>
											{option}
										</option>
									))}
								</select>
							</label>
							<button
								type="button"
								onClick={() => table.firstPage()}
								disabled={!table.getCanPreviousPage()}
							>
								First
							</button>
							<button
								type="button"
								onClick={() => table.previousPage()}
								disabled={!table.getCanPreviousPage()}
							>
								Prev
							</button>
							<button
								type="button"
								onClick={() => table.nextPage()}
								disabled={!table.getCanNextPage()}
							>
								Next
							</button>
							<button
								type="button"
								onClick={() => table.lastPage()}
								disabled={!table.getCanNextPage()}
							>
								Last
							</button>
						</div>
					</div>
				</div>
			)}
		</section>
	);
}
