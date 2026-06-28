import React, { useMemo, useCallback, useState } from 'react';
import AuditTable      from './AuditTable/AuditTable.jsx';
import BottomStatusBar from './BottomStatusBar/BottomStatusBar.jsx';
import { checkThreshold, computeStatQualifyingSet } from '../pivot/PivotTable/PivotTable.logic.jsx';
import './TableView.css';

const DEV_FIELD_PREFIX = '__dev_';

// One row per (deviation × kind) where the corresponding checkbox is on.
// Mirrors `deviationFieldKey(id, kind)` from DeviationColumns.logic.jsx so
// table mode and pivot mode share the same synthetic field-id namespace.
function expandDeviations(deviations) {
  const out = [];
  for (const d of deviations || []) {
    if (!d || !d.id) continue;
    if (d.showDiff)    out.push({ ...d, kind: 'diff',    fieldId: `${DEV_FIELD_PREFIX}${d.id}_diff` });
    if (d.showPercent) out.push({ ...d, kind: 'percent', fieldId: `${DEV_FIELD_PREFIX}${d.id}_percent` });
  }
  return out;
}

/* -------------------------------------------------------------------------
 *  FX conversion (mirrors the helper PivotTable uses, kept inline so table
 *  mode doesn't take a dependency on the pivot module tree).
 * ----------------------------------------------------------------------- */
function applyFx(rawValue, fx, fxRates) {
  if (rawValue === null || rawValue === undefined || rawValue === '' || !fx || !fxRates) return rawValue;
  const n = typeof rawValue === 'number' ? rawValue : parseFloat(String(rawValue).replace(',', ''));
  if (isNaN(n)) return rawValue;
  const monthly = fxRates?.[fx.currency]?.[fx.year]?.[fx.month];
  if (!monthly || typeof monthly !== 'number') return rawValue;
  return fx.direction === 'toIls' ? n * monthly : n / monthly;
}

/* -------------------------------------------------------------------------
 *  Per-row deviation computation. In table mode there's no aggregation —
 *  the deviation is just (rowA - rowB) or its percent variant per row.
 * ----------------------------------------------------------------------- */
function rowDeviationValue(row, dev, kind, fxConversions, fxRates) {
  if (!dev || !dev.sourceA || !dev.sourceB) return null;
  const rawA = row[dev.sourceA];
  const rawB = row[dev.sourceB];
  const a = applyFx(rawA, fxConversions[dev.sourceA] || null, fxRates);
  const b = applyFx(rawB, fxConversions[dev.sourceB] || null, fxRates);
  const an = typeof a === 'number' ? a : parseFloat(String(a).replace(',', ''));
  const bn = typeof b === 'number' ? b : parseFloat(String(b).replace(',', ''));
  if (isNaN(an) || isNaN(bn)) return null;
  if (kind === 'percent') return an === 0 ? 0 : ((an - bn) / an) * 100;
  return an - bn;   // 'diff'
}

/**
 * Table mode orchestrator (v2 — preset-driven).
 *
 * Receives:
 *   data        : Array<Record<columnName, value>>
 *   columns     : string[]
 *   config      : full preset config (flat pivot fields + table slot)
 *   onConfigChange : config updater
 *   fxRates     : currency-conversion table
 *   zoom, setZoom : global table-mode zoom (persisted server-side)
 *
 * Everything that was previously internal state (visible / pinned / sort /
 * filter) now lives on config so it persists via the preset.
 */
export default function TableView({
  data,
  columns,
  // Phase 3 trace props (optional; table behaves as before when omitted)
  onCellTrace,
  hasRefsAtCoord,
  focusCoord,
  highlightSet,
  config,
  onConfigChange,
  fxRates,
  zoom,
  setZoom,
  isLoading = false,
}) {
  const table = config.table || { columnOrder: [], hidden: [], pinned: [], sortBy: null };
  const filters = config.filters || {};

  /* ---- Deviation columns: synthesize & augment row data ---------------
     One column per (deviation × kind) where the corresponding checkbox is
     on. Showing both checkboxes ⇒ two columns side-by-side; unticking one
     drops that column entirely.                                           */
  const expandedDeviations = useMemo(() => expandDeviations(config.deviations), [config.deviations]);

  const deviationFieldIds = useMemo(
    () => expandedDeviations.map((d) => d.fieldId),
    [expandedDeviations]
  );

  const labelMap = useMemo(() => {
    const m = new Map();
    for (const dev of expandedDeviations) {
      m.set(dev.fieldId, dev.kind === 'percent' ? `${dev.name || ''} %`.trim() : (dev.name || '—'));
    }
    return m;
  }, [expandedDeviations]);

  // Each row gets deviation values inserted under each fieldId so the
  // column reads cleanly. We ALSO tag each row with its ORIGINAL index in
  // `data` so the trace UI can translate the post-sort/filter coords
  // AuditTable hands us back to the canonical lineageFrame row index.
  const enrichedRows = useMemo(() => {
    return data.map((row, i) => {
      const next = { ...row, __origRow: i };
      for (const dev of expandedDeviations) {
        next[dev.fieldId] = rowDeviationValue(row, dev, dev.kind, config.fxConversions || {}, fxRates || {});
      }
      return next;
    });
  }, [data, expandedDeviations, config.fxConversions, fxRates]);

  /* ---- Display column resolution (pinned-first preset order) ---------- */
  const allFieldIds = useMemo(
    () => [...columns, ...deviationFieldIds],
    [columns, deviationFieldIds]
  );

  const hiddenSet = useMemo(() => new Set(table.hidden || []), [table.hidden]);
  const pinnedSet = useMemo(() => new Set(table.pinned || []), [table.pinned]);

  // Reconcile columnOrder with the current column universe (drop stale,
  // append newcomers).
  const orderedAll = useMemo(() => {
    const universe = new Set(allFieldIds);
    const persisted = (table.columnOrder || []).filter((c) => universe.has(c));
    const persistedSet = new Set(persisted);
    const newcomers = allFieldIds.filter((c) => !persistedSet.has(c));
    return [...persisted, ...newcomers];
  }, [allFieldIds, table.columnOrder]);

  const visibleColumns = useMemo(
    () => orderedAll.filter((c) => !hiddenSet.has(c)),
    [orderedAll, hiddenSet]
  );

  const pinnedColumns = useMemo(
    () => visibleColumns.filter((c) => pinnedSet.has(c)),
    [visibleColumns, pinnedSet]
  );

  /* ---- For deviation arrows: build checkupData on the fly ------------- */
  const checkupData = useMemo(() => {
    const out = {};
    for (const dev of expandedDeviations) out[dev.fieldId] = true;
    return out;
  }, [expandedDeviations]);

  /* ---- Filter pipeline (shared with pivot — `allowed array` semantics) -
     `config.filters[colId]` is either:
       - undefined / null          → no filter, all rows pass
       - string[] of allowed vals  → only those values pass
     Conversion to/from FilterMenu's excluded-set model happens inside
     AuditTable, so this layer stays clean.                              */
  const filterEntries = useMemo(() => Object.entries(filters), [filters]);

  const filteredRows = useMemo(() => {
    if (filterEntries.length === 0) return enrichedRows;
    return enrichedRows.filter((row) => {
      for (const [colId, allowed] of filterEntries) {
        if (!allowed || !Array.isArray(allowed)) continue;
        if (allowed.length === 0) return false;          // pathological
        const allowSet = new Set(allowed.map(String));
        if (!allowSet.has(String(row[colId] ?? ''))) return false;
      }
      return true;
    });
  }, [enrichedRows, filterEntries]);

  /* ---- Sort pipeline -------------------------------------------------- */
  const sortedRows = useMemo(() => {
    if (!table.sortBy || !table.sortBy.columnId) return filteredRows;
    const { columnId, direction } = table.sortBy;
    const factor = direction === 'asc' ? 1 : -1;
    const copy = [...filteredRows];
    copy.sort((a, b) => {
      const av = a[columnId];
      const bv = b[columnId];
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn) && String(av).trim() !== '' && String(bv).trim() !== '') {
        return (an - bn) * factor;
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'he') * factor;
    });
    return copy;
  }, [filteredRows, table.sortBy]);

  /* ---- Header→config writeback (from right-click context menu) -------- */
  const updateTable = useCallback((partial) => {
    onConfigChange({ ...config, table: { ...table, ...partial } });
  }, [config, table, onConfigChange]);

  const handlePinToggle = useCallback((columnId) => {
    const isPinned = pinnedSet.has(columnId);
    const nextPinned = isPinned
      ? (table.pinned || []).filter((c) => c !== columnId)
      : [...(table.pinned || []), columnId];
    const nextPinnedSet = new Set(nextPinned);
    const pinnedSeg   = orderedAll.filter((c) => nextPinnedSet.has(c));
    const unpinnedSeg = orderedAll.filter((c) => !nextPinnedSet.has(c));
    let nextHidden = table.hidden || [];
    if (!isPinned && hiddenSet.has(columnId)) {
      nextHidden = nextHidden.filter((c) => c !== columnId);
    }
    updateTable({
      pinned:      nextPinned,
      hidden:      nextHidden,
      columnOrder: [...pinnedSeg, ...unpinnedSeg],
    });
  }, [pinnedSet, hiddenSet, table.pinned, table.hidden, orderedAll, updateTable]);

  const handleSortSet = useCallback((columnId, direction) => {
    updateTable({ sortBy: { columnId, direction } });
  }, [updateTable]);

  const handleCancelSort = useCallback(() => {
    updateTable({ sortBy: null });
  }, [updateTable]);

  /* ---- Filter writeback (uses shared config.filters / allowed-array shape) -
     AuditTable hands us `allowed: string[]` already (it inverts FilterMenu's
     excluded-set into allowed values, using the column's full unique-value
     list). We just persist as-is.                                          */
  const handleFilterApply = useCallback((columnId, allowedArray) => {
    const nextFilters = { ...filters };
    if (!allowedArray || allowedArray.length === 0) {
      delete nextFilters[columnId];
    } else {
      nextFilters[columnId] = allowedArray;
    }
    onConfigChange({ ...config, filters: nextFilters });
  }, [config, filters, onConfigChange]);

  /* ---- Cell value resolver — applies FX + deviation labels ------------ */
  // Wrap rows with FX-converted values for raw columns that have FX configured.
  // (Deviation columns already had FX applied during their computation.)
  const fxAdjustedRows = useMemo(() => {
    const fxMap = config.fxConversions || {};
    const hasAnyFx = Object.keys(fxMap).length > 0;
    if (!hasAnyFx) return sortedRows;
    return sortedRows.map((row) => {
      const next = { ...row };
      for (const [colId, fx] of Object.entries(fxMap)) {
        if (!(colId in next)) continue;
        next[colId] = applyFx(next[colId], fx, fxRates || {});
      }
      return next;
    });
  }, [sortedRows, config.fxConversions, fxRates]);

  /* ---- Header label remap for deviation columns ---------------------- */
  // AuditTable receives column ids — for deviations we want the user-facing
  // label to appear in the header. We swap keys on the rows + the column
  // list so the existing header rendering works unchanged.
  const headerLabelFor = useCallback((id) => labelMap.get(id) || id, [labelMap]);

  const renamedRows = useMemo(() => {
    if (labelMap.size === 0) return fxAdjustedRows;
    return fxAdjustedRows.map((row) => {
      const next = { ...row };
      for (const [id, label] of labelMap.entries()) {
        if (id in next) {
          next[label] = next[id];
          delete next[id];
        }
      }
      return next;
    });
  }, [fxAdjustedRows, labelMap]);

  // Same swap for the visible/pinned column lists so the audit table draws
  // the labels in the header + uses the labels as cell-lookup keys.
  const visibleColumnsLabeled = useMemo(
    () => visibleColumns.map(headerLabelFor),
    [visibleColumns, headerLabelFor]
  );
  const pinnedColumnsLabeled = useMemo(
    () => pinnedColumns.map(headerLabelFor),
    [pinnedColumns, headerLabelFor]
  );

  // Map filter state through the same rename so column highlight lights up
  // when the underlying id is filtered.
  const filterStateLabeled = useMemo(() => {
    if (labelMap.size === 0) return filters;
    const out = { ...filters };
    for (const [id, label] of labelMap.entries()) {
      if (id in out) {
        out[label] = out[id];
        delete out[id];
      }
    }
    return out;
  }, [filters, labelMap]);

  const sortStateLabeled = useMemo(() => {
    if (!table.sortBy) return { columnId: null, direction: null };
    const cid = table.sortBy.columnId;
    const remapped = labelMap.get(cid);
    return { columnId: remapped || cid, direction: table.sortBy.direction };
  }, [table.sortBy, labelMap]);

  const checkupDataLabeled = useMemo(() => {
    if (labelMap.size === 0) return checkupData;
    const out = {};
    for (const k of Object.keys(checkupData)) {
      out[labelMap.get(k) || k] = true;
    }
    return out;
  }, [checkupData, labelMap]);

  // Map header callbacks back: header gives us a labeled id, we resolve it
  // to the canonical __dev_*/raw id before writing to config.
  const inverseLabelMap = useMemo(() => {
    const m = new Map();
    for (const [id, label] of labelMap.entries()) m.set(label, id);
    return m;
  }, [labelMap]);

  const resolveCanonical = useCallback(
    (id) => inverseLabelMap.get(id) || id,
    [inverseLabelMap]
  );

  /* =================================================================
   *  Conditional highlighting (threshold + statistical)
   *  --------------------------------------------------------------
   *  Reads `config.thresholds[colId]` + `config.statHighlights[colId]`
   *  (canonical ids) and exposes a per-cell function that returns the
   *  class to append on the TD. Threshold predicates are pure per-value;
   *  stat sets are precomputed once per column based on every row's
   *  value in the (final) rendered data, so the highlight stays correct
   *  when filters/sorts are applied.
   * ================================================================= */
  const thresholds     = config.thresholds     || {};
  const statHighlights = config.statHighlights || {};

  const statSetByDisplayCol = useMemo(() => {
    const map = {};
    visibleColumnsLabeled.forEach((labeled, displayColIdx) => {
      const canonical = resolveCanonical(labeled);
      const cfg = statHighlights[canonical];
      if (!cfg || !cfg.kind) return;
      // Build the list of {path: displayRowIdx, value} for this column.
      const cells = [];
      for (let i = 0; i < renamedRows.length; i++) {
        const v = renamedRows[i]?.[labeled];
        const n = typeof v === 'number' ? v
                : (v != null && !isNaN(parseFloat(v))) ? parseFloat(v)
                : null;
        if (n != null) cells.push({ path: i, value: n });
      }
      map[displayColIdx] = computeStatQualifyingSet(cells, cfg.kind);
    });
    return map;
  }, [visibleColumnsLabeled, renamedRows, statHighlights, resolveCanonical]);

  const cellHighlightClass = useCallback((displayRowIdx, displayColIdx) => {
    const labeled = visibleColumnsLabeled[displayColIdx];
    if (labeled == null) return '';
    const canonical = resolveCanonical(labeled);
    const out = [];
    const thr = thresholds[canonical];
    if (thr) {
      const v = renamedRows[displayRowIdx]?.[labeled];
      const n = typeof v === 'number' ? v
              : (v != null && !isNaN(parseFloat(v))) ? parseFloat(v)
              : null;
      const result = checkThreshold(n, thr);
      if      (result === true)  out.push('is-threshold-pass');
      else if (result === false) out.push('is-threshold-fail');
    }
    const statSet = statSetByDisplayCol[displayColIdx];
    if (statSet && statSet.has(displayRowIdx)) out.push('is-stat-pass');
    return out.join(' ');
  }, [visibleColumnsLabeled, renamedRows, thresholds, statSetByDisplayCol, resolveCanonical]);

  /* ---- Selection stats (bubbled up to the footer) -------------------- */
  const [selectionStats, setSelectionStats] = useState(null);

  /* =================================================================
   *  Lineage-trace coord translator
   *  --------------------------------------------------------------
   *  AuditTable hands us (displayRowIdx, displayColIdx) into the
   *  RENDERED grid (after sort/filter/column-reorder/deviation-relabel).
   *  The trace UI looks up references against the CANONICAL lineageFrame
   *  coords supplied by ReportPage — so we have to translate before
   *  calling the parent's onCellTrace / hasRefsAtCoord.
   *
   *  Column translation:
   *    displayColIdx → visibleColumnsLabeled[i] → resolveCanonical →
   *    index into `columns` (the canonical column-name array
   *    derived from report.lineageFrame.columns).
   *
   *  Row translation:
   *    displayRowIdx → renamedRows[i].__origRow (tagged at enrichment).
   *
   *  Deviation columns DON'T have refs in the wire payload (they're
   *  computed client-side), so we short-circuit hasRefsAtCoord for them.
   * ================================================================= */
  const canonicalColIdx = useCallback((displayColIdx) => {
    const displayName = visibleColumnsLabeled[displayColIdx];
    if (displayName == null) return -1;
    const canonical = resolveCanonical(displayName);
    return columns.indexOf(canonical);
  }, [visibleColumnsLabeled, columns, resolveCanonical]);

  const canonicalRowIdx = useCallback((displayRowIdx) => {
    const row = renamedRows[displayRowIdx];
    if (!row) return -1;
    const orig = row.__origRow;
    return typeof orig === 'number' ? orig : -1;
  }, [renamedRows]);

  const traceAdapter = useMemo(() => ({
    onCellTrace: onCellTrace
      ? (displayRowIdx, displayColIdx) => {
          const rowIdx = canonicalRowIdx(displayRowIdx);
          const colIdx = canonicalColIdx(displayColIdx);
          if (rowIdx < 0 || colIdx < 0) return;
          onCellTrace(rowIdx, colIdx);
        }
      : undefined,
    hasRefsAtCoord: hasRefsAtCoord
      ? (displayRowIdx, displayColIdx) => {
          const rowIdx = canonicalRowIdx(displayRowIdx);
          const colIdx = canonicalColIdx(displayColIdx);
          if (rowIdx < 0 || colIdx < 0) return false;
          return hasRefsAtCoord(rowIdx, colIdx);
        }
      : undefined,
    // focusCoord is in canonical coords; translate the OTHER direction so
    // AuditTable's highlight lands on the right display cell.
    focusCoord: focusCoord
      ? (() => {
          // canonical row → which displayRow holds that __origRow?
          const displayRow = renamedRows.findIndex(
            (r) => r && r.__origRow === focusCoord.rowIndex
          );
          if (displayRow < 0) return null;
          const canonicalName = columns[focusCoord.colIndex];
          if (canonicalName == null) return null;
          // canonical column name → labeled (for visibleColumnsLabeled lookup)
          const labeled = labelMap.get(canonicalName) || canonicalName;
          const displayCol = visibleColumnsLabeled.indexOf(labeled);
          if (displayCol < 0) return null;
          return { rowIndex: displayRow, colIndex: displayCol };
        })()
      : null,
    // highlightSet: translate every canonical (row,col) entry to display
    // (row,col) so AuditTable can paint its purple markers.
    highlightSet: highlightSet
      ? (() => {
          const out = new Set();
          for (const key of highlightSet) {
            const [r, c] = key.split(',').map(Number);
            const displayRow = renamedRows.findIndex(
              (rr) => rr && rr.__origRow === r
            );
            if (displayRow < 0) continue;
            const canonicalName = columns[c];
            if (canonicalName == null) continue;
            const labeled = labelMap.get(canonicalName) || canonicalName;
            const displayCol = visibleColumnsLabeled.indexOf(labeled);
            if (displayCol < 0) continue;
            out.add(`${displayRow},${displayCol}`);
          }
          return out;
        })()
      : null,
  }), [
    onCellTrace, hasRefsAtCoord, focusCoord, highlightSet,
    canonicalRowIdx, canonicalColIdx,
    renamedRows, columns, visibleColumnsLabeled, labelMap,
  ]);

  return (
    <div className="table-view">
      <div className="table-view-body">
        <div className="table-view-main">
          <AuditTable
            rowData={renamedRows}
            allRowData={renamedRows}
            isLoading={isLoading}
            visibleColumns={visibleColumnsLabeled}
            pinnedColumns={pinnedColumnsLabeled}
            sortState={sortStateLabeled}
            filterState={filterStateLabeled}
            onPinToggle={(id)         => handlePinToggle(resolveCanonical(id))}
            onSortSet={(id, dir)      => handleSortSet(resolveCanonical(id), dir)}
            onCancelSort={handleCancelSort}
            onFilterApply={(id, set)  => handleFilterApply(resolveCanonical(id), set)}
            zoom={zoom}
            setZoom={setZoom}
            onSelectionStats={setSelectionStats}
            checkupData={checkupDataLabeled}
            onCellTrace={traceAdapter.onCellTrace}
            hasRefsAtCoord={traceAdapter.hasRefsAtCoord}
            focusCoord={traceAdapter.focusCoord}
            highlightSet={traceAdapter.highlightSet}
            cellHighlightClass={cellHighlightClass}
          />
        </div>
      </div>
      <BottomStatusBar
        zoom={zoom}
        setZoom={setZoom}
        selectionStats={selectionStats}
        disabled={!data || data.length === 0}
      />
    </div>
  );
}
