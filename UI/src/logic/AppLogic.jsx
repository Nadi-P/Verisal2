import { useState, useMemo, useCallback } from 'react';

export function useAppState() {
  const [rowData, setRowData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState({
    companyName: '',
    dateRange: '',
    reportTitle: '',
  });
  const [zoom, setZoom] = useState(100);
  const [sideMenuOpen, setSideMenuOpen] = useState(true);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [selectionStats, setSelectionStats] = useState(null);
  const [checkupData, setCheckupData] = useState({});

  // --- PERSISTENT COMPARISON STATE ---
  const [compData, setCompData] = useState({
    m1: '', y1: '',
    m2: '', y2: ''
  });

  // columns: array of { id, visible, pinned }
  const [columns, setColumns] = useState([]);
  const [sortState, setSortState] = useState({ columnId: null, direction: null });
  const [filterState, setFilterState] = useState({});

  const currentReportTitle = metadata.reportTitle;

  const visibleColumns = useMemo(() => {
    return columns.filter(c => c.visible).map(c => c.id);
  }, [columns]);

  const pinnedColumns = useMemo(() => {
    return columns.filter(c => c.pinned && c.visible).map(c => c.id);
  }, [columns]);

  // Comparison Logic moved to Global State
  const handleRunComparison = useCallback(async (params) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`http://localhost:8000/api/update-months-comparison?${query}`);
      const result = await response.json();
      if (result.status === 'success') {
        setRowData(result.data);
        setCheckupData(result.checkup || {});
        // Update columns based on new data
        if (result.data.length > 0) {
          const keys = Object.keys(result.data[0]);
          setColumns(keys.map(k => ({ id: k, visible: true, pinned: false })));
        }
      }
    } catch (error) {
      console.error("Comparison failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const filteredData = useMemo(() => {
    let data = [...rowData];
    // filterState[colId] is an EXCLUDED set: values the user chose to hide.
    // Rows are kept when their value is NOT in the excluded set.
    // Values that never appeared in the filter dialog are kept by default.
    Object.keys(filterState).forEach(colId => {
      const excludedSet = filterState[colId];
      if (excludedSet && excludedSet.size > 0) {
        data = data.filter(row => !excludedSet.has(String(row[colId])));
      }
    });

    if (sortState.columnId && sortState.direction) {
      const col = sortState.columnId;
      const dir = sortState.direction === 'asc' ? 1 : -1;
      data.sort((a, b) => {
        const va = a[col], vb = b[col];
        const na = parseFloat(va), nb = parseFloat(vb);
        if (!isNaN(na) && !isNaN(nb)) return (na - nb) * dir;
        return String(va ?? '').localeCompare(String(vb ?? ''), 'he') * dir;
      });
    }
    return data;
  }, [rowData, filterState, sortState]);

  const handleColumnsApply = useCallback((updatedColumns) => {
    setColumns(updatedColumns);
    setColumnsPanelOpen(false);
  }, []);

  // Clear ALL active filters at once. Column highlights automatically
  // disappear because isColumnFiltered checks filterState emptiness.
  const clearAllFilters = useCallback(() => {
    setFilterState({});
  }, []);

  const hasActiveFilters = useMemo(
    () => Object.values(filterState).some(s => s && s.size > 0),
    [filterState]
  );

  const handleSortFilter = useCallback(({ sort, filter }) => {
    if (sort !== undefined) setSortState(sort);
    if (filter !== undefined) {
      // If the incoming excluded set for a column is empty, delete the key
      // entirely so "no active filter" and "empty set" are the same state —
      // which matters for the column-highlight logic.
      setFilterState(prev => {
        const next = { ...prev };
        Object.entries(filter).forEach(([colId, set]) => {
          if (!set || set.size === 0) {
            delete next[colId];
          } else {
            next[colId] = set;
          }
        });
        return next;
      });
    }
  }, []);

  return {
    rowData, setRowData,
    filteredData,
    isLoading, setIsLoading,
    metadata, setMetadata,
    zoom, setZoom,
    sideMenuOpen, setSideMenuOpen,
    columnsPanelOpen, setColumnsPanelOpen,
    columns, setColumns,
    visibleColumns,
    pinnedColumns,
    sortState, setSortState,
    filterState, setFilterState,
    selectionStats, setSelectionStats,
    checkupData, setCheckupData,
    handleColumnsApply,
    handleSortFilter,
    clearAllFilters,
    hasActiveFilters,
    currentReportTitle,
    // New persistent fields
    compData, setCompData,
    handleRunComparison
  };
}