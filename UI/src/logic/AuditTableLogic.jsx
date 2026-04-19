import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

const HEBREW_REGEX = /[\u0590-\u05FF]/;

export function useAuditTableLogic({
  rowData, allRowData,
  visibleColumns, pinnedColumns,
  sortState, filterState,
  onSortFilter, zoom, onSelectionStats,
  checkupData
}) {
  // Refs to pinned header cells so we can measure their real widths.
  const pinnedHeaderRefs = useRef({});
  const [pinnedWidths, setPinnedWidths] = useState({});

  const setPinnedHeaderRef = useCallback((col) => (el) => {
    if (el) {
      pinnedHeaderRefs.current[col] = el;
    } else {
      delete pinnedHeaderRefs.current[col];
    }
  }, []);
  const tableContainerRef = useRef(null);

  // Selection state: array of { r, c } for multi-select, plus anchor/end for range
  const [selectionAnchor, setSelectionAnchor] = useState(null); // { r, c }
  const [selectionEnd, setSelectionEnd] = useState(null);       // { r, c }
  const [extraSelections, setExtraSelections] = useState([]);    // array of { start, end }
  const [isSelecting, setIsSelecting] = useState(false);

  // Clear selection whenever the data changes (report switch / new upload)
  useEffect(() => {
    setSelectionAnchor(null);
    setSelectionEnd(null);
    setExtraSelections([]);
    setIsSelecting(false);
  }, [rowData]);

  // Filter menu state
  const [filterMenuState, setFilterMenuState] = useState({
    open: false, columnId: null, position: null
  });

  // ======== COLUMNS ========
  // Display order = [pinned columns in original order] + [unpinned columns in original order].
  // `visibleColumns` is never physically reordered, so unpinning a column
  // naturally drops it back into its original slot.
  const displayColumns = useMemo(() => {
    let base;
    if (visibleColumns.length > 0) {
      base = visibleColumns;
    } else if (rowData && rowData.length > 0) {
      base = Object.keys(rowData[0]);
    } else {
      return [];
    }
    const pinnedSet = new Set(pinnedColumns);
    const pinnedInOrder = base.filter(c => pinnedSet.has(c));
    const unpinnedInOrder = base.filter(c => !pinnedSet.has(c));
    return [...pinnedInOrder, ...unpinnedInOrder];
  }, [visibleColumns, rowData, pinnedColumns]);

  const displayRows = rowData;

  // ======== PINNED / STICKY ========
  const isPinned = useCallback((colId) => pinnedColumns.includes(colId), [pinnedColumns]);

  // Measure real widths of pinned header cells AFTER render so sticky offsets
  // match actual rendered column widths (no more overlap on scroll).
  useLayoutEffect(() => {
    const next = {};
    for (const col of pinnedColumns) {
      const el = pinnedHeaderRefs.current[col];
      if (el) {
        next[col] = el.getBoundingClientRect().width;
      }
    }
    // Only update state if widths actually changed (avoid render loops).
    const prevKeys = Object.keys(pinnedWidths);
    const nextKeys = Object.keys(next);
    let changed = prevKeys.length !== nextKeys.length;
    if (!changed) {
      for (const k of nextKeys) {
        if (Math.abs((pinnedWidths[k] ?? 0) - (next[k] ?? 0)) > 0.5) {
          changed = true;
          break;
        }
      }
    }
    if (changed) setPinnedWidths(next);
  }, [displayColumns, pinnedColumns, zoom, rowData, pinnedWidths]);

  // Calculate cumulative sticky offset for pinned columns (right-to-left).
  // Uses real measured widths when available; falls back to a reasonable
  // estimate before the first measurement pass completes.
  const pinnedOffsets = useMemo(() => {
    const offsets = {};
    let cumulative = 0;
    const pinnedInOrder = displayColumns.filter(c => pinnedColumns.includes(c));
    for (const col of pinnedInOrder) {
      offsets[col] = cumulative;
      const w = pinnedWidths[col];
      cumulative += (w && w > 0) ? w : (150 * (zoom / 100));
    }
    return offsets;
  }, [displayColumns, pinnedColumns, pinnedWidths, zoom]);

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

  // Estimate visible rows in a "page" by measuring an actual rendered row.
  const getPageRowCount = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return 10;
    const sampleRow = container.querySelector('tbody tr');
    const headerH = container.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const rowH = sampleRow ? sampleRow.getBoundingClientRect().height : 28;
    const usable = container.clientHeight - headerH;
    return Math.max(1, Math.floor(usable / Math.max(rowH, 1)) - 1);
  }, []);

  // Keyboard navigation: arrows, shift+arrows, ctrl, page up/down, home/end
  const handleKeyDown = useCallback((e) => {
    if (!selectionEnd) return;
    const { r, c } = selectionEnd;
    let newR = r, newC = c;
    const maxR = displayRows.length - 1;
    const maxC = displayColumns.length - 1;

    // Ctrl+Home / Ctrl+End — jump to row's horizontal extreme, keeping vertical position.
    // RTL semantics: Ctrl+Home → rightmost column (col 0), Ctrl+End → leftmost column (maxC).
    if ((e.ctrlKey || e.metaKey) && (e.key === 'Home' || e.key === 'End')) {
      e.preventDefault();
      const target = { r, c: e.key === 'Home' ? 0 : maxC };
      if (e.shiftKey) {
        setSelectionEnd(target);
      } else {
        setExtraSelections([]);
        setSelectionAnchor(target);
        setSelectionEnd(target);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':    newR = Math.max(0, r - 1); break;
      case 'ArrowDown':  newR = Math.min(maxR, r + 1); break;
      case 'ArrowLeft':  newC = Math.min(maxC, c + 1); break;  // RTL: left = increase col
      case 'ArrowRight': newC = Math.max(0, c - 1); break;     // RTL: right = decrease col
      case 'Home':       newC = 0; break;          // RTL: Home = first col (rightmost)
      case 'End':        newC = maxC; break;        // RTL: End = last col (leftmost)
      case 'PageUp':     newR = Math.max(0, r - getPageRowCount()); break;
      case 'PageDown':   newR = Math.min(maxR, r + getPageRowCount()); break;
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
  }, [selectionEnd, displayRows, displayColumns, getPageRowCount]);

  // Scroll the active cell into view whenever the selection end changes,
  // accounting for the sticky header and any sticky pinned columns on the right (RTL).
  useLayoutEffect(() => {
    if (!selectionEnd) return;
    const container = tableContainerRef.current;
    if (!container) return;
    const cell = container.querySelector(
      `td[data-r="${selectionEnd.r}"][data-c="${selectionEnd.c}"]`
    );
    if (!cell) return;

    const cRect = container.getBoundingClientRect();
    const tRect = cell.getBoundingClientRect();

    // Sticky header height obscures the top of the scroll region.
    const headerEl = container.querySelector('thead');
    const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;

    // Sticky pinned columns sit at the right edge in RTL — sum their widths.
    let pinnedW = 0;
    if (!cell.classList.contains('pinned')) {
      container.querySelectorAll('thead th.pinned').forEach(el => {
        pinnedW += el.getBoundingClientRect().width;
      });
    }

    let dy = 0;
    if (tRect.top < cRect.top + headerH) {
      dy = tRect.top - (cRect.top + headerH);
    } else if (tRect.bottom > cRect.bottom) {
      dy = tRect.bottom - cRect.bottom;
    }

    let dx = 0;
    // RTL: pinned columns are on the right; the visible "right edge" for unpinned cells
    // is cRect.right - pinnedW. Off the left simply means tRect.left < cRect.left.
    const visibleRight = cRect.right - pinnedW;
    if (tRect.right > visibleRight) {
      dx = tRect.right - visibleRight;
    } else if (tRect.left < cRect.left) {
      dx = tRect.left - cRect.left;
    }

    if (dx !== 0 || dy !== 0) {
      container.scrollBy({ top: dy, left: dx });
    }
  }, [selectionEnd]);

  // Mouse-drag auto-scroll: when the user drags past a container edge while selecting,
  // scroll the table and update the selection to the cell now under the cursor.
  const autoScrollRef = useRef({ raf: null, x: 0, y: 0 });
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container || !isSelecting) return;

    const state = autoScrollRef.current;

    const stop = () => {
      if (state.raf) {
        cancelAnimationFrame(state.raf);
        state.raf = null;
      }
    };

    const tick = () => {
      const rect = container.getBoundingClientRect();
      const threshold = 40;
      const maxStep = 24;
      let dx = 0, dy = 0;

      if (state.y < rect.top + threshold) {
        dy = -Math.min(maxStep, (rect.top + threshold - state.y));
      } else if (state.y > rect.bottom - threshold) {
        dy = Math.min(maxStep, (state.y - (rect.bottom - threshold)));
      }
      if (state.x < rect.left + threshold) {
        dx = -Math.min(maxStep, (rect.left + threshold - state.x));
      } else if (state.x > rect.right - threshold) {
        dx = Math.min(maxStep, (state.x - (rect.right - threshold)));
      }

      if (dx === 0 && dy === 0) {
        stop();
        return;
      }

      container.scrollBy({ top: dy, left: dx });

      // After scrolling, find the cell now under the cursor and extend the selection.
      const el = document.elementFromPoint(state.x, state.y);
      const td = el && el.closest && el.closest('td[data-r]');
      if (td) {
        const r = +td.dataset.r;
        const c = +td.dataset.c;
        setSelectionEnd(prev => (prev && prev.r === r && prev.c === c) ? prev : { r, c });
      }
      state.raf = requestAnimationFrame(tick);
    };

    const onMove = (e) => {
      state.x = e.clientX;
      state.y = e.clientY;
      const rect = container.getBoundingClientRect();
      const threshold = 40;
      const nearEdge =
        state.x < rect.left + threshold || state.x > rect.right - threshold ||
        state.y < rect.top + threshold || state.y > rect.bottom - threshold;
      if (nearEdge && !state.raf) {
        state.raf = requestAnimationFrame(tick);
      } else if (!nearEdge) {
        stop();
      }
    };

    window.addEventListener('mousemove', onMove);
    return () => {
      window.removeEventListener('mousemove', onMove);
      stop();
    };
  }, [isSelecting]);

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
  // Format a JS number with thousands separators, keeping 2 decimals only when present.
  const formatNumber = (n) => {
    if (Object.is(n, -0)) n = 0;
    if (Number.isInteger(n)) {
      return n.toLocaleString('en-US');
    }
    const rounded = Math.round(n * 100) / 100;
    if (rounded === 0) return '0.00';
    return rounded.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatCellValue = useCallback((value) => {
    if (value === null || value === undefined) return '';

    if (typeof value === 'number') return formatNumber(value);

    const str = String(value);

    // Detect ISO date/datetime strings from pandas (e.g. "2025-08-01T00:00:00" or "2025-08-01")
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }

    // Decimal numeric strings (e.g. "1234.5") — format with thousands + 2 decimals.
    const num = parseFloat(str);
    if (!isNaN(num) && str.includes('.') && str === String(num)) {
      return formatNumber(num);
    }

    // Catch string "-0"
    if (str === '-0') return '0';

    return str;
  }, []);

  // Returns 'up' | 'down' | null. Only set for "diff" columns (those tracked in
  // checkupData). Sign of the raw numeric value drives direction; zero → no arrow.
  const getCellArrow = useCallback((row, col) => {
    if (!checkupData || !(col in checkupData)) return null;
    const raw = row[col];
    const n = typeof raw === 'number' ? raw : parseFloat(raw);
    if (!isFinite(n) || n === 0) return null;
    return n > 0 ? 'up' : 'down';
  }, [checkupData]);

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


  // ======== COLUMN HIGHLIGHT (filter / sort) ========
  const isColumnFiltered = useCallback((colId) => {
    const s = filterState[colId];
    return !!(s && s.size > 0);
  }, [filterState]);

  const isColumnSorted = useCallback((colId) => {
    return sortState.columnId === colId && !!sortState.direction;
  }, [sortState]);

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
    getCellArrow,
    isColumnFiltered,
    isColumnSorted,
    setPinnedHeaderRef,
  };
}
