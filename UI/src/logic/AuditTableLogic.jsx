import { useState, useMemo, useRef, useCallback, useEffect } from 'react';

const HEBREW_REGEX = /[\u0590-\u05FF]/;

export function useAuditTableLogic({
  rowData, allRowData,
  visibleColumns, pinnedColumns,
  sortState, filterState,
  onSortFilter, zoom, onSelectionStats,
  checkupData
}) {
  const tableContainerRef = useRef(null);

  // Selection state: array of { r, c } for multi-select, plus anchor/end for range
  const [selectionAnchor, setSelectionAnchor] = useState(null); // { r, c }
  const [selectionEnd, setSelectionEnd] = useState(null);       // { r, c }
  const [extraSelections, setExtraSelections] = useState([]);    // array of { start, end }
  const [isSelecting, setIsSelecting] = useState(false);

  // Filter menu state
  const [filterMenuState, setFilterMenuState] = useState({
    open: false, columnId: null, position: null
  });

  // ======== COLUMNS ========
  const displayColumns = useMemo(() => {
    if (visibleColumns.length > 0) return visibleColumns;
    if (!rowData || rowData.length === 0) return [];
    return Object.keys(rowData[0]);
  }, [visibleColumns, rowData]);

  const displayRows = rowData;

  // ======== PINNED / STICKY ========
  const isPinned = useCallback((colId) => pinnedColumns.includes(colId), [pinnedColumns]);

  // Calculate cumulative sticky offset for pinned columns (right-to-left)
  const pinnedOffsets = useMemo(() => {
    const offsets = {};
    let cumulative = 0;
    // Pin order = order in displayColumns that are pinned
    const pinnedInOrder = displayColumns.filter(c => pinnedColumns.includes(c));
    for (const col of pinnedInOrder) {
      offsets[col] = cumulative;
      // Estimate width — we'll use a base of 120px scaled by zoom
      cumulative += Math.max(80, 120) * (zoom / 100);
    }
    return offsets;
  }, [displayColumns, pinnedColumns, zoom]);

  const getStickyOffset = useCallback((colId) => {
    return pinnedOffsets[colId] ?? 0;
  }, [pinnedOffsets]);

  // ======== SORT ========
  const handleSort = useCallback((columnId) => {
    let newDirection;
    if (sortState.columnId !== columnId || sortState.direction === null) {
      newDirection = 'asc';
    } else if (sortState.direction === 'asc') {
      newDirection = 'desc';
    } else {
      newDirection = 'asc';
    }
    onSortFilter({ sort: { columnId, direction: newDirection } });
  }, [sortState, onSortFilter]);

  const getSortIcon = useCallback((columnId) => {
    if (sortState.columnId !== columnId || !sortState.direction) {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" opacity="0.4">
          <path d="M12 5v14M5 12l7-7 7 7" />
        </svg>
      );
    }
    if (sortState.direction === 'asc') {
      return (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 19V5M5 12l7-7 7 7" />
        </svg>
      );
    }
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M12 5v14M5 12l7 7 7-7" />
      </svg>
    );
  }, [sortState]);

  // ======== FILTER ========
  const openFilterMenu = useCallback((columnId, event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setFilterMenuState({
      open: true,
      columnId,
      position: { top: rect.bottom + 4, left: rect.left }
    });
  }, []);

  const closeFilterMenu = useCallback(() => {
    setFilterMenuState({ open: false, columnId: null, position: null });
  }, []);

  const applyFilter = useCallback((columnId, selectedValues) => {
    onSortFilter({ filter: { [columnId]: selectedValues } });
    closeFilterMenu();
  }, [onSortFilter, closeFilterMenu]);

  const getUniqueValues = useCallback((columnId) => {
    if (!allRowData || allRowData.length === 0) return [];
    const vals = new Set();
    allRowData.forEach(row => vals.add(String(row[columnId] ?? '')));
    return Array.from(vals).sort((a, b) => a.localeCompare(b, 'he'));
  }, [allRowData]);

  // ======== SELECTION ========
  const getAllSelectedCells = useCallback(() => {
    const cells = new Set();
    const addRange = (start, end) => {
      if (!start || !end) return;
      const minR = Math.min(start.r, end.r), maxR = Math.max(start.r, end.r);
      const minC = Math.min(start.c, end.c), maxC = Math.max(start.c, end.c);
      for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
          cells.add(`${r},${c}`);
        }
      }
    };
    // Current active range
    addRange(selectionAnchor, selectionEnd);
    // Extra ranges from Ctrl+Click
    extraSelections.forEach(s => addRange(s.start, s.end));
    return cells;
  }, [selectionAnchor, selectionEnd, extraSelections]);

  const isCellSelected = useCallback((r, c) => {
    return getAllSelectedCells().has(`${r},${c}`);
  }, [getAllSelectedCells]);

  // Border classes for Excel-like selection frame
  const selectionBorderClass = useCallback((r, c) => {
    if (!isCellSelected(r, c)) return '';
    const classes = [];
    if (!isCellSelected(r - 1, c)) classes.push('sel-top');
    if (!isCellSelected(r + 1, c)) classes.push('sel-bottom');
    if (!isCellSelected(r, c - 1)) classes.push('sel-left');
    if (!isCellSelected(r, c + 1)) classes.push('sel-right');
    return classes.join(' ');
  }, [isCellSelected]);

  const handleMouseDown = useCallback((r, c, e) => {
    if (e.ctrlKey || e.metaKey) {
      // Ctrl+Click: add current range to extras, start new range
      if (selectionAnchor && selectionEnd) {
        setExtraSelections(prev => [...prev, { start: selectionAnchor, end: selectionEnd }]);
      }
      setSelectionAnchor({ r, c });
      setSelectionEnd({ r, c });
    } else {
      // Normal click: reset everything
      setExtraSelections([]);
      setSelectionAnchor({ r, c });
      setSelectionEnd({ r, c });
    }
    setIsSelecting(true);
  }, [selectionAnchor, selectionEnd]);

  const handleMouseEnter = useCallback((r, c, e) => {
    if (isSelecting) {
      setSelectionEnd({ r, c });
    }
  }, [isSelecting]);

  const handleMouseUp = useCallback(() => {
    setIsSelecting(false);
  }, []);

  // Keyboard navigation: arrows, shift+arrows, ctrl+shift
  const handleKeyDown = useCallback((e) => {
    if (!selectionEnd) return;
    const { r, c } = selectionEnd;
    let newR = r, newC = c;
    const maxR = displayRows.length - 1;
    const maxC = displayColumns.length - 1;

    switch (e.key) {
      case 'ArrowUp':    newR = Math.max(0, r - 1); break;
      case 'ArrowDown':  newR = Math.min(maxR, r + 1); break;
      case 'ArrowLeft':  newC = Math.min(maxC, c + 1); break;  // RTL: left = increase col
      case 'ArrowRight': newC = Math.max(0, c - 1); break;     // RTL: right = decrease col
      default: return;
    }

    e.preventDefault();

    if (e.shiftKey) {
      // Extend selection
      setSelectionEnd({ r: newR, c: newC });
    } else if (e.ctrlKey || e.metaKey) {
      // Jump to edge (simplified: jump to boundary)
      if (e.key === 'ArrowUp') newR = 0;
      if (e.key === 'ArrowDown') newR = maxR;
      if (e.key === 'ArrowLeft') newC = maxC;
      if (e.key === 'ArrowRight') newC = 0;
      setExtraSelections([]);
      setSelectionAnchor({ r: newR, c: newC });
      setSelectionEnd({ r: newR, c: newC });
    } else {
      // Move selection
      setExtraSelections([]);
      setSelectionAnchor({ r: newR, c: newC });
      setSelectionEnd({ r: newR, c: newC });
    }
  }, [selectionEnd, displayRows, displayColumns]);

  // ======== SELECTION STATS ========
  useEffect(() => {
    if (!displayRows.length || !selectionAnchor || !selectionEnd) {
      onSelectionStats(null);
      return;
    }

    const selectedCells = getAllSelectedCells();
    const values = [];
    const colNames = [];

    selectedCells.forEach(key => {
      const [r, c] = key.split(',').map(Number);
      if (r < displayRows.length && c < displayColumns.length) {
        const colId = displayColumns[c];
        values.push(displayRows[r][colId]);
        colNames.push(colId);
      }
    });

    const count = values.length;
    if (count === 0) { onSelectionStats(null); return; }

    if (count === 1) {
      onSelectionStats({ type: 'single', label: colNames[0], value: values[0] });
      return;
    }

    const numericValues = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

    if (count === 2 && numericValues.length === 2) {
      const sum = numericValues[0] + numericValues[1];
      const avg = sum / 2;
      const sorted = [...numericValues].sort((a, b) => a - b);
      const ratio = sorted[1] !== 0 ? ((sorted[0] / sorted[1]) * 100).toFixed(2) : '0.00';
      onSelectionStats({
        type: 'multi',
        sum: sum.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        avg: avg.toFixed(2),
        count,
        ratio,
      });
      return;
    }

    // 3+ cells
    if (numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const avg = sum / numericValues.length;
      onSelectionStats({
        type: 'multi',
        sum: sum.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        avg: avg.toFixed(2),
        count,
        ratio: null,
      });
    } else {
      onSelectionStats({ type: 'multi', sum: null, avg: null, count, ratio: null });
    }
  }, [selectionAnchor, selectionEnd, extraSelections, displayRows, displayColumns, getAllSelectedCells, onSelectionStats]);

  // ======== FORMATTING ========
  const formatCellValue = useCallback((value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') {
      // If it's a decimal, cut after 2 digits
      if (!Number.isInteger(value)) {
        return value.toFixed(2);
      }
      return String(value);
    }
    const str = String(value);
    // Check if it's a numeric string with decimals
    const num = parseFloat(str);
    if (!isNaN(num) && str.includes('.') && str === String(num)) {
      return num.toFixed(2);
    }
    return str;
  }, []);

  const getTextDirection = useCallback((text) => {
    if (typeof text === 'string' && HEBREW_REGEX.test(text)) return 'rtl';
    return 'ltr';
  }, []);

  // ======== ZOOM ========
  const getCellStyle = useCallback(() => {
    const scale = zoom / 100;
    return {
      fontSize: `${13 * scale}px`,
      padding: `${3 * scale}px ${10 * scale}px`,
    };
  }, [zoom]);

  const getHeaderStyle = useCallback(() => {
    const scale = zoom / 100;
    return {
      fontSize: `${13 * scale}px`,
      padding: `${6 * scale}px ${10 * scale}px`,
    };
  }, [zoom]);

  const getCellCheckupColor = useCallback((row, col) => {
    const colChecks = checkupData[col];
    if (!colChecks) return null;
    // Find this row's index in the original data
    const rowIndex = rowData.indexOf(row);
    if (rowIndex === -1 || rowIndex >= colChecks.length) return null;
    return colChecks[rowIndex] ? 'checkup-pass' : 'checkup-fail';
  }, [checkupData, rowData]);

  return {
    tableContainerRef,
    displayColumns,
    displayRows,
    handleMouseDown,
    handleMouseEnter,
    handleMouseUp,
    handleKeyDown,
    isCellSelected,
    selectionBorderClass,
    getStickyOffset,
    isPinned,
    handleSort,
    getSortIcon,
    filterMenuState,
    openFilterMenu,
    closeFilterMenu,
    applyFilter,
    getUniqueValues,
    formatCellValue,
    getTextDirection,
    getCellStyle,
    getHeaderStyle,
    getCellCheckupColor,
  };
}
