import { useState, useMemo, useCallback } from 'react';

export function useAppState() {
  // --- 1. ALL useState HOOKS AT THE VERY TOP ---
  const [rowData, setRowData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [metadata, setMetadata] = useState({
    companyName: '',
    dateRange: '',
    reportTitle: '',
    reportFileName: '',
  });
  const [reportsLoaded, setReportsLoaded] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [zoom, setZoom] = useState(100);
  const [sideMenuOpen, setSideMenuOpen] = useState(true);
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [selectionStats, setSelectionStats] = useState(null);
  const [checkupData, setCheckupData] = useState({});
  const [compData, setCompData] = useState({ m1: '', y1: '', m2: '', y2: '' });
  const [columns, setColumns] = useState([]);
  const [sortState, setSortState] = useState({ columnId: null, direction: null });
  const [filterState, setFilterState] = useState({});

  // --- 2. SIMPLE DERIVED VARIABLES ---
  const currentReportTitle = metadata.reportTitle;

  // --- 3. ALL useMemo HOOKS ---
  const visibleColumns = useMemo(() => {
    return columns.filter(c => c.visible).map(c => c.id);
  }, [columns]);

  const pinnedColumns = useMemo(() => {
    return columns.filter(c => c.pinned && c.visible).map(c => c.id);
  }, [columns]);

  const hasActiveFilters = useMemo(
    () => Object.values(filterState).some(s => s && s.size > 0),
    [filterState]
  );

  const filteredData = useMemo(() => {
    let data = [...rowData];
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

  // --- 4. ALL useCallback HOOKS ---
  const handleRunComparison = useCallback(async (params) => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams(params).toString();
      const response = await fetch(`http://localhost:8000/api/update-months-comparison?${query}`);
      const result = await response.json();
      if (result.status === 'success') {
        setRowData(result.data);
        setCheckupData(result.checkup || {});
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

  const handleColumnsApply = useCallback((updatedColumns) => {
    setColumns(updatedColumns);
    setColumnsPanelOpen(false);
  }, []);

  const clearAllFilters = useCallback(() => {
    setFilterState({});
  }, []);

  const handleSortFilter = useCallback(({ sort, filter }) => {
    if (sort !== undefined) setSortState(sort);
    if (filter !== undefined) {
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
    reportsLoaded, setReportsLoaded,
    loadError, setLoadError,
    compData, setCompData,
    handleRunComparison
  };
}