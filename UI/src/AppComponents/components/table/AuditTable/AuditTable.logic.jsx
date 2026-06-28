/**
 * Audit-table logic — pure data + interaction. Owns:
 *
 *   - display column order (pinned + unpinned in original order)
 *   - real measured pinned-column widths via useLayoutEffect, with a
 *     `150px × zoom` fallback before the first measurement pass.
 *   - selection state (anchor, end, extras, isSelecting) + Excel-style
 *     mouse + keyboard navigation + scroll-into-view + drag auto-scroll.
 *   - sort + filter menu state (filter values come from outside).
 *   - per-cell formatting (numbers / percentages / ISO dates / Hebrew flip)
 *     and per-cell text direction.
 *   - per-row "diff" arrow direction from checkupData.
 *   - cell + header zoom-aware styles.
 *
 * Functional invariants preserved verbatim from v1 — no behavioural drift.
 */
import { useState, useMemo, useRef, useCallback, useEffect, useLayoutEffect } from 'react';

const HEBREW_REGEX = /[֐-׿]/;

export function useAuditTableLogic({
  rowData, allRowData,
  visibleColumns, pinnedColumns,
  sortState, filterState,
  zoom, setZoom, onSelectionStats,
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
  const [selectionEnd, setSelectionEnd]       = useState(null); // { r, c }
  const [extraSelections, setExtraSelections] = useState([]);   // array of { start, end }
  const [isSelecting, setIsSelecting]         = useState(false);

  // Clear selection whenever the data changes (report switch / new upload)
  useEffect(() => {
    setSelectionAnchor(null);
    setSelectionEnd(null);
    setExtraSelections([]);
    setIsSelecting(false);
  }, [rowData]);

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
    const pinnedInOrder   = base.filter((c) => pinnedSet.has(c));
    const unpinnedInOrder = base.filter((c) => !pinnedSet.has(c));
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
    const pinnedInOrder = displayColumns.filter((c) => pinnedColumns.includes(c));
    for (const col of pinnedInOrder) {
      offsets[col] = cumulative;
      const w = pinnedWidths[col];
      cumulative += (w && w > 0) ? w : (150 * (zoom / 100));
    }
    return offsets;
  }, [displayColumns, pinnedColumns, pinnedWidths, zoom]);

  const getStickyOffset = useCallback((colId) => pinnedOffsets[colId] ?? 0, [pinnedOffsets]);

  // Ctrl + wheel: zoom the table by ±5% per notch (clamped 50–200, matching
  // the BottomStatusBar slider). Attached as non-passive so we can suppress
  // the browser's default page-zoom behavior.
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container || !setZoom) return;
    const onWheel = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      setZoom((z) => Math.max(50, Math.min(200, z + delta)));
    };
    container.addEventListener('wheel', onWheel, { passive: false });
    return () => container.removeEventListener('wheel', onWheel);
  }, [setZoom]);

  const getUniqueValues = useCallback((columnId) => {
    if (!allRowData || allRowData.length === 0) return [];
    const vals = new Set();
    allRowData.forEach((row) => vals.add(String(row[columnId] ?? '')));
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
    addRange(selectionAnchor, selectionEnd);
    extraSelections.forEach((s) => addRange(s.start, s.end));
    return cells;
  }, [selectionAnchor, selectionEnd, extraSelections]);

  const isCellSelected = useCallback((r, c) => getAllSelectedCells().has(`${r},${c}`), [getAllSelectedCells]);

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
        setExtraSelections((prev) => [...prev, { start: selectionAnchor, end: selectionEnd }]);
      }
      setSelectionAnchor({ r, c });
      setSelectionEnd({ r, c });
    } else {
      setExtraSelections([]);
      setSelectionAnchor({ r, c });
      setSelectionEnd({ r, c });
    }
    setIsSelecting(true);
  }, [selectionAnchor, selectionEnd]);

  const handleMouseEnter = useCallback((r, c) => {
    if (isSelecting) setSelectionEnd({ r, c });
  }, [isSelecting]);

  const handleMouseUp = useCallback(() => setIsSelecting(false), []);

  // Estimate visible rows in a "page". Under virtualization a "first sample
  // row" may not be in the DOM at the moment, so callers can pass in an
  // estimated row height (the value the virtualizer already knows) via
  // `rowHeightHint`. Falls back to measuring a rendered row when present.
  const getPageRowCount = useCallback((rowHeightHint) => {
    const container = tableContainerRef.current;
    if (!container) return 10;
    const headerH   = container.querySelector('thead')?.getBoundingClientRect().height ?? 0;
    const sampleRow = container.querySelector('tbody tr[data-r]');
    const rowH      = sampleRow ? sampleRow.getBoundingClientRect().height
                                : (rowHeightHint && rowHeightHint > 0 ? rowHeightHint : 28);
    const usable    = container.clientHeight - headerH;
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
      setSelectionEnd({ r: newR, c: newC });
    } else if (e.ctrlKey || e.metaKey) {
      if (e.key === 'ArrowUp') newR = 0;
      if (e.key === 'ArrowDown') newR = maxR;
      if (e.key === 'ArrowLeft') newC = maxC;
      if (e.key === 'ArrowRight') newC = 0;
      setExtraSelections([]);
      setSelectionAnchor({ r: newR, c: newC });
      setSelectionEnd({ r: newR, c: newC });
    } else {
      setExtraSelections([]);
      setSelectionAnchor({ r: newR, c: newC });
      setSelectionEnd({ r: newR, c: newC });
    }
  }, [selectionEnd, displayRows, displayColumns, getPageRowCount]);

  // Scroll-into-view was moved to AuditTable.jsx because under virtualization
  // the target row's DOM node may not exist at this layer's effect-time. The
  // component owns the virtualizer and runs scrollToIndex first, then the
  // horizontal correction after the row is rendered.

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

      if (dx === 0 && dy === 0) { stop(); return; }

      container.scrollBy({ top: dy, left: dx });

      const el = document.elementFromPoint(state.x, state.y);
      const td = el && el.closest && el.closest('td[data-r]');
      if (td) {
        const r = +td.dataset.r;
        const c = +td.dataset.c;
        setSelectionEnd((prev) => (prev && prev.r === r && prev.c === c) ? prev : { r, c });
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
        state.y < rect.top + threshold  || state.y > rect.bottom - threshold;
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

    selectedCells.forEach((key) => {
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

    const numericValues = values.map((v) => parseFloat(v)).filter((v) => !isNaN(v));

    if (count === 2 && numericValues.length === 2) {
      const sum = numericValues[0] + numericValues[1];
      const avg = sum / 2;
      const sorted = [...numericValues].sort((a, b) => a - b);
      const ratio = sorted[1] !== 0 ? ((sorted[0] / sorted[1]) * 100).toFixed(2) : '0.00';
      onSelectionStats({
        type: 'multi',
        sum:  sum.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        avg:  avg.toFixed(2),
        count,
        ratio,
      });
      return;
    }

    if (numericValues.length > 0) {
      const sum = numericValues.reduce((a, b) => a + b, 0);
      const avg = sum / numericValues.length;
      onSelectionStats({
        type: 'multi',
        sum:  sum.toLocaleString(undefined, { maximumFractionDigits: 2 }),
        avg:  avg.toFixed(2),
        count,
        ratio: null,
      });
    } else {
      onSelectionStats({ type: 'multi', sum: null, avg: null, count, ratio: null });
    }
  }, [selectionAnchor, selectionEnd, extraSelections, displayRows, displayColumns, getAllSelectedCells, onSelectionStats]);

  // ======== FORMATTING ========
  // Columns whose header contains ALL substrings of any tuple below render
  // raw integers without thousand separators (IDs / year / month / emp no).
  const NO_COMMA_HEADER_TUPLES = [
    ['מס', 'זהות'],
    ['שנת', 'עבודה'],
    ['חודש', 'עבודה'],
    ['מספר', 'עובד'],
  ];
  const columnSuppressesCommas = (col) =>
    typeof col === 'string' &&
    NO_COMMA_HEADER_TUPLES.some((tuple) => tuple.every((s) => col.includes(s)));

  // Format a JS number with thousands separators, keeping 2 decimals only when present.
  const formatNumber = (n, noCommas = false) => {
    if (Object.is(n, -0)) n = 0;
    if (Number.isInteger(n)) {
      return noCommas ? String(n) : n.toLocaleString('en-US');
    }
    const rounded = Math.round(n * 100) / 100;
    if (rounded === 0) return '0.00';
    return rounded.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: !noCommas,
    });
  };

  const formatCellValue = useCallback((value, col) => {
    if (value === null || value === undefined) return '';

    const noCommas = columnSuppressesCommas(col);

    if (typeof value === 'number') return formatNumber(value, noCommas);

    const str = String(value);

    // Percentage strings (e.g. "0.00%", "12.50%", "-3.00%"): drop ".00" when
    // the fractional part is zero so "0.00%" renders as "0%", "12.50%" stays.
    const pctMatch = str.match(/^(-?\d+(?:\.\d+)?)%$/);
    if (pctMatch) {
      const n = parseFloat(pctMatch[1]);
      if (!isNaN(n)) {
        return (Number.isInteger(n) ? `${n}` : n.toFixed(2).replace(/\.?0+$/, '')) + '%';
      }
    }

    // Detect ISO date/datetime strings (e.g. "2025-08-01T00:00:00" or "2025-08-01")
    const isoMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})(T.*)?$/);
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      return `${day}/${month}/${year}`;
    }

    // Decimal numeric strings (e.g. "1234.5") — format with thousands + 2 decimals.
    const num = parseFloat(str);
    if (!isNaN(num) && str.includes('.') && str === String(num)) {
      return formatNumber(num, noCommas);
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
      padding:  `${3 * scale}px ${10 * scale}px`,
    };
  }, [zoom]);

  const getHeaderStyle = useCallback(() => {
    const scale = zoom / 100;
    return {
      fontSize: `${13 * scale}px`,
      padding:  `${6 * scale}px ${10 * scale}px`,
    };
  }, [zoom]);

  // ======== COLUMN HIGHLIGHT (filter / sort) ========
  // filterState is the shared `allowed array` shape (pivot's).
  // A column is considered "actively filtered" iff an allowed array exists.
  const isColumnFiltered = useCallback((colId) => {
    const s = filterState[colId];
    if (!s) return false;
    if (Array.isArray(s)) return s.length > 0;
    if (s instanceof Set) return s.size > 0;          // back-compat
    return false;
  }, [filterState]);

  const isColumnSorted = useCallback(
    (colId) => sortState.columnId === colId && !!sortState.direction,
    [sortState]
  );

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
    getUniqueValues,
    formatCellValue,
    getTextDirection,
    getCellStyle,
    getHeaderStyle,
    getCellArrow,
    isColumnFiltered,
    isColumnSorted,
    setPinnedHeaderRef,
    // Exposed for the component-level virtualization layer.
    selectionEnd,
    getPageRowCount,
  };
}
