import React, { useState, useCallback, useMemo, useRef, useLayoutEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import FilterMenu         from '../FilterMenu/FilterMenu.jsx';
import HeaderContextMenu  from '../HeaderContextMenu/HeaderContextMenu.jsx';
import { IconTrendUp, IconTrendDown } from '../../icons.jsx';
import { useAuditTableLogic } from './AuditTable.logic.jsx';
import './AuditTable.css';
import '../../../theme.css';


/**
 * Excel-style audit table — v2.
 *
 * Row rendering is virtualized via @tanstack/react-virtual. Only the rows in
 * (or near) the viewport actually mount, so sort/pin/filter operations on a
 * 50k-row report stay as snappy as a 50-row one.
 *
 * The DOM shape is a real `<table>` with `<thead>` + `<tbody>`. Inside
 * `<tbody>` we render two spacer rows (top + bottom) whose heights add up to
 * the un-rendered rows' total height, and only the virtual window's `<tr>`s
 * between them. This preserves the natural scroll height + scrollbar behaviour
 * while keeping the DOM small.
 *
 * Everything else (selection, keyboard nav, drag auto-scroll, sort/filter
 * routing, right-click context menu, Hebrew formatting, pinned-column sticky
 * offsets) is unchanged from the pre-virtualization version.
 */
function AuditTable({
  rowData, allRowData, isLoading,
  visibleColumns, pinnedColumns,
  sortState, filterState,
  onPinToggle, onSortSet, onCancelSort,
  onFilterApply,
  zoom, setZoom, onSelectionStats,
  checkupData,
  /** Lineage trace integration (Phase 3). All optional — when omitted
   *  the table behaves exactly as before. */
  onCellTrace,                       // (rowIndex, colIndex) — fired on
                                     //   double-right-click of a cell that
                                     //   has lineage refs
  hasRefsAtCoord,                    // (rowIndex, colIndex) → bool
  focusCoord,                        // { rowIndex, colIndex } | null —
  highlightSet,                      // Set<`r,c`> | null — all cells to mark purple
                                     //   purple highlight target
  cellHighlightClass,                // (r, c) → 'is-threshold-pass' | 'is-threshold-fail' | 'is-stat-pass' | ''
}) {
  const {
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
    formatCellValue,
    getTextDirection,
    getCellStyle,
    getHeaderStyle,
    getCellArrow,
    isColumnFiltered,
    isColumnSorted,
    setPinnedHeaderRef,
    getUniqueValues,
    selectionEnd,
  } = useAuditTableLogic({
    rowData, allRowData,
    visibleColumns, pinnedColumns,
    sortState, filterState,
    zoom, setZoom, onSelectionStats,
    checkupData,
  });

  // Any column key carried in checkupData drives the deviation arrow —
  // by construction those are the deviation columns. Reuse the same map
  // as the styling predicate so deviation tinting + arrow stay in sync.
  const isDeviationCol = useCallback(
    (col) => !!checkupData && Object.prototype.hasOwnProperty.call(checkupData, col),
    [checkupData],
  );

  // ----------------------------------------------------------------------
  // Double-right-click detection for lineage-trace
  //
  // Two right-clicks on the SAME cell within `DOUBLE_RIGHT_CLICK_MS` fires
  // `onCellTrace`. Single right-clicks on cells do nothing visible (we still
  // preventDefault to suppress the browser menu). The cell must have lineage
  // refs (`hasRefsAtCoord` returns true) — otherwise the gesture is silently
  // ignored, per the user spec.
  // ----------------------------------------------------------------------
  const DOUBLE_RIGHT_CLICK_MS = 400;
  const lastRightClickRef = React.useRef({ time: 0, key: '' });

  const handleCellContextMenu = useCallback((e, rowIndex, colIndex) => {
    e.preventDefault();
    e.stopPropagation();
    if (!onCellTrace) return;
    const key = `${rowIndex},${colIndex}`;
    const now = Date.now();
    const wasDouble =
      now - lastRightClickRef.current.time < DOUBLE_RIGHT_CLICK_MS
      && lastRightClickRef.current.key === key;
    if (wasDouble) {
      lastRightClickRef.current = { time: 0, key: '' };
      if (hasRefsAtCoord && hasRefsAtCoord(rowIndex, colIndex)) {
        onCellTrace(rowIndex, colIndex);
      }
    } else {
      lastRightClickRef.current = { time: now, key };
    }
  }, [onCellTrace, hasRefsAtCoord]);

  /* ------------------------------------------------------------------
   *  Virtualizer
   *  --------
   *  Container ref points to the scrollable `.audit-table-container`,
   *  same element keyboard nav + drag autoscroll act on. estimateSize
   *  derives the row height from the current zoom (the cell padding +
   *  font-size scale linearly with zoom), and measureElement reads each
   *  rendered row's real height so wrapped/odd-sized rows position
   *  correctly.
   * ------------------------------------------------------------------ */
  const scale = zoom / 100;
  // base = (3*scale top + 3*scale bottom padding) + (13*scale font * ~1.4 line-height) + 1px border
  const estRowHeight = useMemo(() => Math.ceil(13 * scale * 1.4 + 6 * scale + 1), [scale]);

  const rowVirtualizer = useVirtualizer({
    count: displayRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => estRowHeight,
    overscan: 10,
    measureElement: (el) => el?.getBoundingClientRect().height ?? estRowHeight,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();
  const totalSize   = rowVirtualizer.getTotalSize();
  const topSpacer    = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const bottomSpacer = virtualRows.length > 0 ? totalSize - virtualRows[virtualRows.length - 1].end : totalSize;

  /* ------------------------------------------------------------------
   *  Column widths — stable across virtualization
   *  -------------------------------------------------------------
   *  Without this layer, `<table width: max-content>` picks each column's
   *  width from whatever cells are CURRENTLY in the DOM. The virtualizer
   *  mounts ~30 rows; widest-visible cell changes as the user scrolls;
   *  columns visibly resize → jank.
   *
   *  Fix: compute every column's natural width from the ENTIRE dataset
   *  once (whenever data/cols change), declare it via `<colgroup><col>`,
   *  and switch the table to `table-layout: fixed` so the browser locks
   *  to the declared widths and never re-measures rows.
   *
   *  Pass 1 (heavy) — per-column "longest formatted string length",
   *    scanned across the entire dataset + the header. Recomputed only
   *    when columns or data change. ~O(rows × cols), ~20–50 ms for
   *    50k × 30, runs sync inside useMemo.
   *  Pass 2 (cheap) — multiply char count by zoom-derived per-char
   *    pixel width + padding + safety. Recomputed on every zoom tick.
   *
   *  The estimate is intentionally generous (8 px/char, 8 px safety)
   *  so wide Latin + mixed-script content still fits — we'd rather
   *  reserve a few extra pixels than ever clip a row mid-scroll.
   * ------------------------------------------------------------------ */
  const colCharLengths = useMemo(() => {
    const out = {};
    for (const col of displayColumns) {
      const header = String(col ?? '');
      // Headers may wrap onto two lines, so the effective character count
      // for the header is roughly half its length — bounded below by the
      // longest single word (which can't be broken).
      const words       = header.split(/\s+/).filter(Boolean);
      const longestWord = words.reduce((m, w) => Math.max(m, w.length), 1);
      const headerEff   = Math.max(longestWord, Math.ceil(header.length / 2));

      let maxBody = 0;
      for (let i = 0; i < displayRows.length; i++) {
        const v = displayRows[i][col];
        if (v == null || v === '') continue;
        const s = formatCellValue(v, col);
        if (typeof s === 'string') {
          if (s.length > maxBody) maxBody = s.length;
        } else if (s != null) {
          const len = String(s).length;
          if (len > maxBody) maxBody = len;
        }
      }
      out[col] = Math.max(headerEff, maxBody);
    }
    return out;
  }, [displayColumns, displayRows, formatCellValue]);

  const columnWidths = useMemo(() => {
    const scaleZoom    = zoom / 100;
    const charWidthPx  = 8.0  * scaleZoom;     // generous estimate
    const horizPadPx   = 20   * scaleZoom;     // cell L+R padding (10+10)
    const safetyPx     = 8;                    // absorb font-metric noise
    const borderPx     = 1;
    const minWidthPx   = Math.ceil(48 * scaleZoom);
    const out = {};
    for (const col of displayColumns) {
      const chars = colCharLengths[col] || 0;
      out[col] = Math.max(
        minWidthPx,
        Math.ceil(chars * charWidthPx + horizPadPx + safetyPx + borderPx),
      );
    }
    return out;
  }, [displayColumns, colCharLengths, zoom]);

  /* ------------------------------------------------------------------
   *  Scroll-into-view for the active selection cell.
   *  Two-phase: scrollToIndex brings the row into the virtual window;
   *  a rAF later we read the real cell rect and apply the precise
   *  vertical (sticky-header-aware) + horizontal (sticky-pinned-cols-aware)
   *  correction.
   * ------------------------------------------------------------------ */
  useLayoutEffect(() => {
    if (!selectionEnd) return;
    const container = tableContainerRef.current;
    if (!container) return;

    // Phase 1 — vertical: ensure the target row is rendered.
    try { rowVirtualizer.scrollToIndex(selectionEnd.r, { align: 'auto' }); }
    catch { /* defensive — virtualizer may not be ready on first paint */ }

    // Phase 2 — precise correction once the row is in the DOM.
    const raf = requestAnimationFrame(() => {
      const cell = container.querySelector(
        `td[data-r="${selectionEnd.r}"][data-c="${selectionEnd.c}"]`
      );
      if (!cell) return;

      const cRect = container.getBoundingClientRect();
      const tRect = cell.getBoundingClientRect();
      const headerEl = container.querySelector('thead');
      const headerH = headerEl ? headerEl.getBoundingClientRect().height : 0;

      let pinnedW = 0;
      if (!cell.classList.contains('pinned')) {
        container.querySelectorAll('thead th.pinned').forEach((el) => {
          pinnedW += el.getBoundingClientRect().width;
        });
      }

      let dy = 0;
      if (tRect.top < cRect.top + headerH)        dy = tRect.top - (cRect.top + headerH);
      else if (tRect.bottom > cRect.bottom)        dy = tRect.bottom - cRect.bottom;

      let dx = 0;
      const visibleRight = cRect.right - pinnedW;
      if (tRect.right > visibleRight)              dx = tRect.right - visibleRight;
      else if (tRect.left < cRect.left)            dx = tRect.left  - cRect.left;

      if (dx !== 0 || dy !== 0) container.scrollBy({ top: dy, left: dx });
    });

    return () => cancelAnimationFrame(raf);
  }, [selectionEnd, rowVirtualizer]);

  /* ------------------------------------------------------------------
   *  Scroll-to-cell for the lineage-trace focus target.
   *  Same two-phase pattern as selection scroll-into-view, but driven by
   *  the focusCoord prop instead of the internal selectionEnd state.
   * ------------------------------------------------------------------ */
  useLayoutEffect(() => {
    if (!focusCoord) return;
    const container = tableContainerRef.current;
    if (!container) return;

    // When arriving from a mode-switch (pivot → table) or a cross-report
    // navigation, the table/virtualizer may not have rendered the target row
    // yet on the first frame. Retry for a few frames until the cell exists,
    // so a single click lands on the cell (no second click needed).
    let raf = 0;
    let tries = 0;
    const MAX_TRIES = 25;

    const attempt = () => {
      try { rowVirtualizer.scrollToIndex(focusCoord.rowIndex, { align: 'center' }); }
      catch { /* defensive — virtualizer may not be ready yet */ }

      raf = requestAnimationFrame(() => {
        const cell = container.querySelector(
          `td[data-r="${focusCoord.rowIndex}"][data-c="${focusCoord.colIndex}"]`
        );
        if (!cell) {
          if (tries++ < MAX_TRIES) attempt();   // row not in the DOM yet — keep trying
          return;
        }
        const cRect = container.getBoundingClientRect();
        const tRect = cell.getBoundingClientRect();
        const headerH =
          container.querySelector('thead')?.getBoundingClientRect().height ?? 0;
        let pinnedW = 0;
        if (!cell.classList.contains('pinned')) {
          container.querySelectorAll('thead th.pinned').forEach((el) => {
            pinnedW += el.getBoundingClientRect().width;
          });
        }
        let dy = 0;
        if (tRect.top < cRect.top + headerH) dy = tRect.top - (cRect.top + headerH);
        else if (tRect.bottom > cRect.bottom) dy = tRect.bottom - cRect.bottom;
        let dx = 0;
        const visibleRight = cRect.right - pinnedW;
        if (tRect.right > visibleRight) dx = tRect.right - visibleRight;
        else if (tRect.left < cRect.left) dx = tRect.left - cRect.left;
        if (dx !== 0 || dy !== 0) container.scrollBy({ top: dy, left: dx });
      });
    };

    attempt();
    return () => cancelAnimationFrame(raf);
  }, [focusCoord, rowVirtualizer]);

  /* ------------------------------------------------------------------
   *  Header context-menu + filter-menu state (component-owned)
   * ------------------------------------------------------------------ */
  const [ctxMenu,    setCtxMenu]    = useState(null);
  const [filterMenu, setFilterMenu] = useState(null);

  const handleHeaderContext = useCallback((columnId, event) => {
    event.preventDefault();
    setCtxMenu({ columnId, position: { top: event.clientY, left: event.clientX } });
  }, []);
  const closeCtxMenu     = useCallback(() => setCtxMenu(null),    []);
  const closeFilterMenu  = useCallback(() => setFilterMenu(null), []);
  const openFilterFromCtx = useCallback(() => {
    if (!ctxMenu) return;
    setFilterMenu({ columnId: ctxMenu.columnId, position: ctxMenu.position });
  }, [ctxMenu]);

  /* ------------------------------------------------------------------
   *  Empty / loading states
   * ------------------------------------------------------------------ */
  if (isLoading) {
    return (
      <div className="table-message">
        <div className="loading-spinner" />
        <span>טוען דוח...</span>
      </div>
    );
  }
  if (!rowData || rowData.length === 0) {
    return (
      <div className="table-message">
        <div className="empty-message">אין נתונים להצגה</div>
      </div>
    );
  }

  const colCount = displayColumns.length;

  return (
    <div
      ref={tableContainerRef}
      className="audit-table-container"
      onMouseUp={handleMouseUp}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <table className="audit-table">
        {/* Stable per-column widths so virtualization can't cause column
            jumps. Browser respects these because `.audit-table` is
            `table-layout: fixed`. */}
        <colgroup>
          {displayColumns.map((col) => (
            <col key={col} style={{ width: `${columnWidths[col] || 100}px` }} />
          ))}
        </colgroup>
        <thead>
          <tr>
            {displayColumns.map((col) => {
              const pinned    = isPinned(col);
              const stickyOff = getStickyOffset(col);
              const filtered  = isColumnFiltered(col);
              const sorted    = isColumnSorted(col);
              const headerCls =
                `table-header-cell${pinned ? ' pinned' : ''}${filtered ? ' filtered' : ''}${sorted ? ' sorted' : ''}`;
              return (
                <th
                  key={col}
                  ref={pinned ? setPinnedHeaderRef(col) : null}
                  className={headerCls}
                  style={{
                    ...getHeaderStyle(),
                    ...(pinned ? {right: stickyOff } : {}),
                  }}
                  onContextMenu={(e) => handleHeaderContext(col, e)}
                >
                  <div className="header-content">
                    <span className="header-text" title={col}>{col}</span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {topSpacer > 0 && (
            <tr aria-hidden="true" className="virtual-spacer-row" style={{ height: topSpacer }}>
              <td colSpan={colCount} />
            </tr>
          )}
          {virtualRows.map((virtualRow) => {
            const rowIndex = virtualRow.index;
            const row      = displayRows[rowIndex];
            return (
              <tr
                key={rowIndex}
                data-index={rowIndex}
                className={rowIndex % 2 === 1 ? 'odd-row' : ''}
                ref={rowVirtualizer.measureElement}
              >
                {displayColumns.map((col, colIndex) => {
                  const selected      = isCellSelected(rowIndex, colIndex);
                  const borderClasses = selectionBorderClass(rowIndex, colIndex);
                  const pinned        = isPinned(col);
                  const stickyOff     = getStickyOffset(col);
                  const filteredCol   = isColumnFiltered(col) ? 'filtered-col' : '';
                  const sortedCol     = isColumnSorted(col)   ? 'sorted-col'   : '';
                  const devCol        = isDeviationCol(col)   ? 'is-deviation' : '';
                  const value         = row[col];
                  let formatted       = formatCellValue(value, col);
                  // Percent-deviation columns ship plain numeric values
                  // (e.g. 12.5 meaning 12.5%). Append "%" so the cell
                  // renders the same way as the column header (which
                  // already has " %" in its display name).
                  if (devCol && typeof col === 'string' && col.endsWith(' %')
                      && formatted && !formatted.endsWith('%')) {
                    formatted = `${formatted}%`;
                  }
                  const dir           = getTextDirection(formatted);
                  const arrow         = getCellArrow(row, col);

                  const hasRefs = hasRefsAtCoord ? hasRefsAtCoord(rowIndex, colIndex) : false;
                  const isFocus =
                    (focusCoord
                      && focusCoord.rowIndex === rowIndex
                      && focusCoord.colIndex === colIndex)
                    || (highlightSet && highlightSet.has(`${rowIndex},${colIndex}`));
                  const condClass = cellHighlightClass
                    ? cellHighlightClass(rowIndex, colIndex)
                    : '';

                  return (
                    <td
                      key={col}
                      data-r={rowIndex}
                      data-c={colIndex}
                      className={`table-cell ${selected ? 'selected' : ''} ${borderClasses} ${pinned ? 'pinned' : ''} ${filteredCol} ${sortedCol} ${devCol} ${hasRefs ? 'has-refs' : ''} ${isFocus ? 'is-trace-target' : ''} ${condClass}`}
                      style={{
                        ...getCellStyle(),
                        direction: dir,
                        textAlign: 'right',
                        ...(pinned ? { position: 'sticky', right: stickyOff, zIndex: 3 } : {}),
                      }}
                      onMouseDown={(e) => handleMouseDown(rowIndex, colIndex, e)}
                      onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                      onContextMenu={(e) => handleCellContextMenu(e, rowIndex, colIndex)}
                    >
                      {formatted}
                      {arrow && (
                        <span className={`cell-arrow is-${arrow}`} aria-hidden="true">
                          {arrow === 'up'
                            ? <IconTrendUp   size={10} />
                            : <IconTrendDown size={10} />}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          {bottomSpacer > 0 && (
            <tr aria-hidden="true" className="virtual-spacer-row" style={{ height: bottomSpacer }}>
              <td colSpan={colCount} />
            </tr>
          )}
        </tbody>
      </table>

      {ctxMenu && (
        <HeaderContextMenu
          position={ctxMenu.position}
          pinned={isPinned(ctxMenu.columnId)}
          sortDir={sortState.columnId === ctxMenu.columnId ? sortState.direction : null}
          onPinToggle={() => onPinToggle(ctxMenu.columnId)}
          onFilter={openFilterFromCtx}
          onSortAsc={() => onSortSet(ctxMenu.columnId, 'asc')}
          onSortDesc={() => onSortSet(ctxMenu.columnId, 'desc')}
          onCancelSort={() => onCancelSort()}
          onClose={closeCtxMenu}
        />
      )}

      {filterMenu && (() => {
        // Shared filter shape is `allowed: string[]`. FilterMenu speaks
        // "excluded set". Convert in + out so both sides stay coherent.
        const allValues   = getUniqueValues(filterMenu.columnId);
        const allowed     = filterState[filterMenu.columnId];
        const excludedSet = (() => {
          if (!Array.isArray(allowed)) return new Set();
          const allowSet = new Set(allowed.map(String));
          return new Set(allValues.map(String).filter((v) => !allowSet.has(v)));
        })();
        return (
          <FilterMenu
            columnId={filterMenu.columnId}
            allValues={allValues}
            currentFilter={excludedSet}
            onApply={(nextExcluded) => {
              const allowedNext = allValues
                .map(String)
                .filter((v) => !nextExcluded.has(v));
              onFilterApply(filterMenu.columnId, allowedNext);
              closeFilterMenu();
            }}
            onCancel={closeFilterMenu}
            position={filterMenu.position}
          />
        );
      })()}
    </div>
  );
}

export default AuditTable;
