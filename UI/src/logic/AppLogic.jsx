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

  // columns: array of { id, visible, pinned }
  const [columns, setColumns] = useState([]);

  // Sort: { columnId, direction: 'asc' | 'desc' | null }
  const [sortState, setSortState] = useState({ columnId: null, direction: null });

  // Filter: { [columnId]: Set of selected values } — if key missing, all shown
  const [filterState, setFilterState] = useState({});

  const currentReportTitle = metadata.reportTitle;

  // Derive visible/pinned columns
  const visibleColumns = useMemo(() => {
    return columns.filter(c => c.visible).map(c => c.id);
  }, [columns]);

  const pinnedColumns = useMemo(() => {
    return columns.filter(c => c.pinned && c.visible).map(c => c.id);
  }, [columns]);

  // Apply filtering
  const filteredData = useMemo(() => {
    if (!rowData || rowData.length === 0) return [];
    let data = [...rowData];

    // Apply filters
    const filterKeys = Object.keys(filterState);
    if (filterKeys.length > 0) {
      data = data.filter(row => {
        return filterKeys.every(colId => {
          const allowedSet = filterState[colId];
          if (!allowedSet || allowedSet.size === 0) return true;
          return allowedSet.has(String(row[colId]));
        });
      });
    }

    // Apply sort
    if (sortState.columnId && sortState.direction) {
      const col = sortState.columnId;
      const dir = sortState.direction === 'asc' ? 1 : -1;
      data.sort((a, b) => {
        const va = a[col];
        const vb = b[col];
        const na = parseFloat(va);
        const nb = parseFloat(vb);
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

  const handleSortFilter = useCallback(({ sort, filter }) => {
    if (sort !== undefined) setSortState(sort);
    if (filter !== undefined) {
      setFilterState(prev => ({ ...prev, ...filter }));
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
    handleColumnsApply,
    handleSortFilter,
    currentReportTitle,
  };
}
