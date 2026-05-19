import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DataGrid, type Column } from 'react-data-grid';
import 'react-data-grid/lib/styles.css';
import Button from '../ui/buttom';
import { type GridPreferences } from '../../types/gridPreferences';

export interface ProductDataGridProps<T extends { id: string }> {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  error?: string | null;
  height?: string;
  rowHeight?: number;
  onRowClick?: (row: T, index: number) => void;
  onRowDoubleClick?: (row: T) => void;
  onRowSelect?: (rowId: string | null) => void;
  selectedRowId?: string | null;
  showColumnVisibility?: boolean;
  emptyState?: React.ReactNode;
  storageKey?: string;
}

function ProductDataGrid<T extends { id: string }>({
  columns,
  rows,
  loading = false,
  error = null,
  height = '420px',
  rowHeight = 32,
  onRowClick,
  onRowDoubleClick,
  onRowSelect,
  selectedRowId = null,
  showColumnVisibility = true,
  emptyState,
  storageKey,
}: ProductDataGridProps<T>) {
  const [selectedRowIndex, setSelectedRowIndex] = useState<number | null>(null);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(
    columns.map((c) => c.key as string),
  );
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const persistPreferences = useCallback(
    (next?: Partial<GridPreferences>) => {
      if (!storageKey || !window.gridPreferences?.save) return;
      const payload: GridPreferences = {
        visibleColumns: next?.visibleColumns ?? visibleColumnKeys,
        columnWidths: next?.columnWidths ?? columnWidths,
      };

      window.gridPreferences
        .save(storageKey, payload)
        .catch((error: unknown) =>
          console.error('Failed to persist grid preferences', error),
        );
    },
    [storageKey, visibleColumnKeys, columnWidths],
  );

  // Keep local state aligned with column definitions
  useEffect(() => {
    const columnKeys = columns.map((c) => c.key as string);
    setVisibleColumnKeys((prev) => {
      const filtered = prev.filter((key) => columnKeys.includes(key));
      return filtered.length > 0 ? filtered : columnKeys;
    });
    setColumnWidths((prev) => {
      const filteredEntries = Object.entries(prev).filter(([key]) =>
        columnKeys.includes(key),
      );
      return Object.fromEntries(filteredEntries);
    });
  }, [columns]);

  // Load persisted preferences
  useEffect(() => {
    let mounted = true;
    const loadPreferences = async () => {
      if (!storageKey || !window.gridPreferences?.get) return;
      try {
        const stored = await window.gridPreferences.get(storageKey);
        if (!mounted || !stored) return;

        const columnKeys = columns.map((c) => c.key as string);

        if (
          Array.isArray(stored.visibleColumns) &&
          stored.visibleColumns.length
        ) {
          const validKeys = stored.visibleColumns.filter((key) =>
            columnKeys.includes(key),
          );
          if (validKeys.length > 0) {
            setVisibleColumnKeys(validKeys);
          }
        }

        if (stored.columnWidths) {
          const filteredWidths = Object.entries(stored.columnWidths).reduce(
            (acc, [key, width]) => {
              if (columnKeys.includes(key) && typeof width === 'number') {
                acc[key] = width;
              }
              return acc;
            },
            {} as Record<string, number>,
          );
          if (Object.keys(filteredWidths).length > 0) {
            setColumnWidths(filteredWidths);
          }
        }
      } catch (error) {
        console.error('Failed to load grid preferences', error);
      }
    };

    loadPreferences();

    return () => {
      mounted = false;
    };
  }, [columns, storageKey]);

  const handleRowClick = (row: T, idx: number) => {
    setSelectedRowIndex(idx);
    if (onRowClick) {
      onRowClick(row, idx);
    }
    if (onRowSelect) {
      onRowSelect(row.id);
    }
  };

  const handleRowDoubleClick = (row: T) => {
    if (onRowDoubleClick) {
      onRowDoubleClick(row);
    }
  };

  const handleToggleColumn = (key: string) => {
    setVisibleColumnKeys((prev) => {
      const next = prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key];
      persistPreferences({ visibleColumns: next });
      return next;
    });
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard events if user is typing in input
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (rows.length === 0) return;

      let newIndex = selectedRowIndex;

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          if (selectedRowIndex === null) {
            newIndex = 0;
          } else {
            newIndex = Math.min(selectedRowIndex + 1, rows.length - 1);
          }
          break;
        case 'ArrowUp':
          event.preventDefault();
          if (selectedRowIndex === null) {
            newIndex = rows.length - 1;
          } else {
            newIndex = Math.max(selectedRowIndex - 1, 0);
          }
          break;
        case 'Enter':
          event.preventDefault();
          if (selectedRowId && onRowDoubleClick) {
            const row = rows.find((r) => r.id === selectedRowId);
            if (row) {
              onRowDoubleClick(row);
            }
          }
          return;
        default:
          return;
      }

      if (newIndex !== null && newIndex !== selectedRowIndex) {
        const newRow = rows[newIndex];
        if (newRow) {
          if (onRowSelect) {
            onRowSelect(newRow.id);
          }
          setSelectedRowIndex(newIndex);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rows, selectedRowIndex, selectedRowId, onRowDoubleClick, onRowSelect]);

  const visibleColumns = columns
    .filter((col) => visibleColumnKeys.includes(col.key as string))
    .map((col) => {
      const key = col.key as string;
      const width = columnWidths[key];
      if (width && Number.isFinite(width)) {
        return { ...col, width };
      }
      return col;
    });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };

    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  // Update selectedRowIndex when selectedRowId changes externally
  useEffect(() => {
    if (selectedRowId) {
      const idx = rows.findIndex((r) => r.id === selectedRowId);
      if (idx >= 0) {
        setSelectedRowIndex(idx);
      }
    } else {
      setSelectedRowIndex(null);
    }
  }, [selectedRowId, rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center" style={{ height }}>
        <div className="text-red-500">{error}</div>
      </div>
    );
  }

  if (rows.length === 0 && emptyState) {
    return <div style={{ height }}>{emptyState}</div>;
  }

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-lg">
      {/* Column visibility dropdown */}
      {showColumnVisibility && columns.length > 0 && (
        <div className="px-5 py-3 border-b border-gray-200 bg-gray-50 flex justify-end">
          <div className="relative" ref={dropdownRef}>
            <Button
              type="button"
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl font-medium shadow-sm hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 flex items-center gap-2"
              // this doesnt work for some reason, not improtaant right now
              onKeyDown={(e) => {
                if (e.key === 'TAB') {
                  e.preventDefault();
                }
              }}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
              Columns
            </Button>

            {/* Dropdown menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-200 z-50 py-2 max-h-96 overflow-y-auto">
                {columns.map((col) => {
                  const key = col.key as string;
                  return (
                    <label
                      key={key}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={visibleColumnKeys.includes(key)}
                        onChange={() => handleToggleColumn(key)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{col.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 bg-white">
        <div style={{ height }}>
          <div
            ref={gridRef}
            onKeyDown={(e) => {
              // Handle keyboard events within the grid
              if (e.key === 'Enter' && selectedRowId && onRowDoubleClick) {
                e.preventDefault();
                const row = rows.find((r) => r.id === selectedRowId);
                if (row) {
                  onRowDoubleClick(row);
                }
              }
            }}
          >
            <DataGrid
              className="rdg-light border-t border-b border-gray-200"
              columns={visibleColumns}
              rows={rows}
              rowHeight={rowHeight}
              onCellClick={(args) => {
                const row = args.row;
                const idx = rows.findIndex((r) => r.id === row.id);
                if (idx >= 0) {
                  handleRowClick(row, idx);
                }
              }}
              onCellDoubleClick={(args) => {
                const row = args.row;
                handleRowDoubleClick(row);
              }}
              selectedRows={
                selectedRowId
                  ? new Set<string>([selectedRowId])
                  : new Set<string>()
              }
              onSelectedRowsChange={(selected) => {
                const selectedId = Array.from(selected)[0] as
                  | string
                  | undefined;
                if (selectedId) {
                  if (onRowSelect) {
                    onRowSelect(selectedId);
                  }
                  const idx = rows.findIndex((r) => r.id === selectedId);
                  if (idx >= 0) {
                    setSelectedRowIndex(idx);
                  }
                }
              }}
              defaultColumnOptions={{
                resizable: true,
              }}
              onColumnResize={(column, width) => {
                const key = column.key as string;
                setColumnWidths((prev) => {
                  const next = { ...prev, [key]: width };
                  persistPreferences({ columnWidths: next });
                  return next;
                });
              }}
              rowKeyGetter={(row) => row.id}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProductDataGrid;
