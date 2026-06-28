import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

import { useUploadManager } from '../../contexts/UploadManagerContext.jsx';
import { useTrace }         from '../../contexts/TraceContext.jsx';
import { lineageFrameToRowMajor } from '../../../lib/uploadManager.js';

import { API_BASE } from '../../../lib/apiBase.js';

const EMPTY_TABLE = {
  columnOrder: [],          // string[] — full column order (pinned first, then unpinned)
  hidden:      [],          // string[] — hidden column ids
  pinned:      [],          // string[] — pinned column ids (subset of columnOrder, displayed first)
  sortBy:      null,        // { columnId, direction: 'asc' | 'desc' } | null
};

const EMPTY_CONFIG = {
  // Pivot-mode (flat — preserved verbatim so existing pivot screens keep working)
  rows: [],
  columns: [],
  values: [],
  filters: {},              // SHARED between pivot + table
  fxConversions: {},
  thresholds: {},
  statHighlights: {},
  deviations: [],
  // Pivot-mode expansion state — paths of expanded row groups. Persisted
  // (like table-mode state) so leaving + returning restores the exact tree.
  expanded: [],
  // Table-mode (new — added alongside the flat pivot fields)
  table: { ...EMPTY_TABLE },
};

/**
 * Name-reference model:
 *   - savedPresets is the source of truth for all presets that exist.
 *   - defaultName + appliedName are strings (or null) that point into savedPresets.
 *   - config is the live editor draft. Diverges from savedPresets[appliedName]
 *     until the user explicitly saves (override or save-as-new).
 *
 * Fallback resolution chain (for display + override target):
 *   appliedName → defaultName → null
 *   (each step requires the name to actually exist in savedPresets)
 */
export function useReportPageLogic(reportId) {
  const { payload, hydrating, getReport } = useUploadManager();
  const trace = useTrace();

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [columns, setColumns]   = useState([]);
  const [data, setData]         = useState([]);
  const [metadata, setMetadata] = useState(null);   // { company_name, min/max month+year, display_label }
  const [report, setReport]     = useState(null);   // raw Report block (carries status, exceptions, etc.)
  // Cell-references side-channel — used by the Phase 3 trace UI to look up
  // the references for a cell at (colIdx, rowIdx) in O(1).
  const [refsByCoord, setRefsByCoord] = useState(new Map());
  const [columnFormulas, setColumnFormulas] = useState({});

  const [savedPresets, setSavedPresets] = useState({});
  const [defaultName, setDefaultName]   = useState(null);
  const [appliedName, setAppliedName]   = useState(null);
  const [config, setConfig]             = useState(EMPTY_CONFIG);
  // Skip the very first draft-save after a fresh load — the config we
  // just set IS what came back from the server, no need to round-trip.
  const skipNextDraftSave = useRef(true);

  const [fxRates, setFxRates] = useState({});

  // Listen for external FX-rate updates so changes anywhere (FX
  // management page, side-panel rate dialog, etc.) cascade into the
  // current report's display IMMEDIATELY — without this, columns that
  // depend on a newly-added rate would silently keep their stale value.
  useEffect(() => {
    const onUpdate = (e) => {
      if (e.detail && typeof e.detail === 'object') setFxRates(e.detail);
    };
    window.addEventListener('fx-rates-updated', onUpdate);
    return () => window.removeEventListener('fx-rates-updated', onUpdate);
  }, []);

  // Sidebar open/closed — lifted here so the report top bar can toggle it.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Global display settings (persisted server-side via /api/config/display-settings).
  // These survive across reports AND across app restarts — one mode + one zoom
  // for the whole app, exactly as the director asked.
  const [displayMode, setDisplayMode] = useState('pivot');
  const [tableZoom, setTableZoom]     = useState(100);
  const [exportFormat, setExportFormat] = useState('ask');  // 'ask' | 'custom' | 'original'

  // Hydrate once on mount; ignore failures (defaults already in place).
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/config/display-settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        if (body.mode === 'pivot' || body.mode === 'table') setDisplayMode(body.mode);
        if (Number.isFinite(body.zoom)) setTableZoom(body.zoom);
        if (['ask', 'custom', 'original'].includes(body.exportFormat)) setExportFormat(body.exportFormat);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Fire-and-forget POST of a partial payload. Used by both setters.
  const pushDisplaySetting = useCallback((partial) => {
    fetch(`${API_BASE}/api/config/display-settings`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(partial),
    }).catch(() => { /* persistence is best-effort */ });
  }, []);

  const setDisplayModePersisted = useCallback((mode) => {
    setDisplayMode(mode);
    pushDisplaySetting({ mode });
  }, [pushDisplaySetting]);

  const setExportFormatPersisted = useCallback((fmt) => {
    setExportFormat(fmt);
    pushDisplaySetting({ exportFormat: fmt });
  }, [pushDisplaySetting]);

  // Zoom changes 5%-at-a-time from a slider — debounce so we don't hammer
  // the disk while the user drags.
  const zoomDebounceRef = useRef(null);
  const setTableZoomPersisted = useCallback((zoomOrUpdater) => {
    setTableZoom((prev) => {
      const next = typeof zoomOrUpdater === 'function' ? zoomOrUpdater(prev) : zoomOrUpdater;
      if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
      zoomDebounceRef.current = setTimeout(() => pushDisplaySetting({ zoom: next }), 400);
      return next;
    });
  }, [pushDisplaySetting]);

  const [toast, setToast]   = useState(null);
  const toastTimer          = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ---- Resolution helpers ---- */
  const resolvedAppliedName = useMemo(() => {
    if (appliedName && savedPresets[appliedName]) return appliedName;
    if (defaultName && savedPresets[defaultName]) return defaultName;
    return null;
  }, [appliedName, defaultName, savedPresets]);

  const resolvedDefaultName = useMemo(() => {
    if (defaultName && savedPresets[defaultName]) return defaultName;
    return null;
  }, [defaultName, savedPresets]);

  /* ---- Hydrate from the UploadManager context + fetch presets / fx ----
     Data no longer comes from /api/reports/{id}/data — the Report+frame
     live in the UploadManagerContext payload. Presets + FX remain remote
     because they're per-user persistent state, not per-upload state.    */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);

      // While the global UploadManager is still hydrating from the backend,
      // wait — we'll re-run when payload becomes available.
      if (hydrating) return;

      try {
        const reportBlock = getReport(reportId);
        setReport(reportBlock);

        const isRenderable = !!reportBlock
          && reportBlock.status === 'loaded'
          && reportBlock.lineageFrame;

        if (isRenderable) {
          const view = lineageFrameToRowMajor(reportBlock.lineageFrame);
          setColumns(view.columns);
          setData(view.data);
          setRefsByCoord(view.refsByCoord);
          setColumnFormulas(view.formulas);
          setDataLoaded(true);
          setMetadata({
            company_name:  reportBlock.company_name,
            min_month:     reportBlock.min_month,
            min_year:      reportBlock.min_year,
            max_month:     reportBlock.max_month,
            max_year:      reportBlock.max_year,
            display_label: reportBlock.display_label,
          });
        } else {
          setColumns([]);
          setData([]);
          setRefsByCoord(new Map());
          setColumnFormulas({});
          setDataLoaded(false);
          setMetadata(null);
        }

        // Presets + DRAFT + FX in parallel. The DRAFT is the user's
        // live state — pins, FX conversions, etc. survive across
        // navigations. We fall back to the default preset only when no
        // draft has been saved yet.
        const [presetRes, draftRes, fxRes] = await Promise.all([
          fetch(`${API_BASE}/api/table-presets/${reportId}`),
          fetch(`${API_BASE}/api/table-presets/${reportId}/draft`),
          fetch(`${API_BASE}/api/config/fx`),
        ]);
        const presetBody = presetRes.ok ? await presetRes.json() : {};
        const draftBody  = draftRes.ok  ? await draftRes.json()  : {};
        const fxBody     = fxRes.ok     ? await fxRes.json()     : {};
        if (cancelled) return;

        const saved   = presetBody.saved || {};
        const defName = presetBody.defaultName || null;
        const startName = defName && saved[defName] ? defName : null;

        setSavedPresets(saved);
        setDefaultName(defName);
        setAppliedName(null);

        // Draft wins if it has any content. Empty draft → default preset
        // → empty config.
        const hasDraft = draftBody && typeof draftBody === 'object'
          && Object.keys(draftBody).length > 0;
        if (hasDraft) {
          setConfig(normalizeConfig(draftBody));
        } else if (startName) {
          setConfig(normalizeConfig(saved[startName]));
        } else {
          setConfig({ ...EMPTY_CONFIG });
        }
        setFxRates(fxBody || {});

      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    skipNextDraftSave.current = true;  // load just set config from server
    load();
    return () => { cancelled = true; };
  }, [reportId, payload, hydrating, getReport]);

  /* ---- Draft persistence -------------------------------------------
     Every config edit is debounced-saved as the report's DRAFT, so
     leaving the report and coming back picks up exactly where the
     user left off (pinned columns, FX conversions, etc.). The very
     first save after a fresh load is skipped — the config we have
     IS what the server just gave us. */
  useEffect(() => {
    if (loading || !reportId) return;
    if (skipNextDraftSave.current) {
      skipNextDraftSave.current = false;
      return;
    }
    const t = setTimeout(() => {
      fetch(`${API_BASE}/api/table-presets/${reportId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      }).then(() => {
        // Tell the FX management page (if open) to refresh its list.
        window.dispatchEvent(new CustomEvent('fx-appliances-updated'));
      }).catch(() => { /* non-fatal */ });
    }, 400);
    return () => clearTimeout(t);
  }, [config, reportId, loading]);

  /* ---- Unique values per field (for filter pickers) ---- */
  const uniqueValuesFor = useCallback((field) => {
    const set = new Set();
    for (const row of data) set.add(row[field]);
    return Array.from(set).sort((a, b) =>
      String(a).localeCompare(String(b), undefined, { numeric: true })
    );
  }, [data]);

  /* ===================================================================
     Preset operations
     =================================================================== */

  // POST a named preset to the backend (creates or overwrites).
  const persistNamed = useCallback(async (name, preset) => {
    const res = await fetch(`${API_BASE}/api/table-presets/${reportId}/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, preset }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }, [reportId]);

  // POST the defaultName reference to the backend.
  const persistDefaultName = useCallback(async (name) => {
    const res = await fetch(`${API_BASE}/api/table-presets/${reportId}/default`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `HTTP ${res.status}`);
    }
  }, [reportId]);

  /**
   * "Override current" — write the live config into the resolved applied preset.
   * Caller must guarantee resolvedAppliedName is non-null (UI disables otherwise).
   */
  const onOverrideCurrent = useCallback(async () => {
    const target = resolvedAppliedName;
    if (!target) {
      showToast('אין תבנית להחלפה', 'error');
      return;
    }
    try {
      await persistNamed(target, config);
      setSavedPresets((prev) => ({ ...prev, [target]: config }));
      setAppliedName(target);
    } catch (e) {
      showToast(`שגיאה: ${e.message}`, 'error');
    }
  }, [resolvedAppliedName, config, persistNamed, showToast]);

  /**
   * "Save as new" — create a new preset under `name`. If there's no default
   * yet, the new preset is auto-set as the default.
   */
  const onSaveNamed = useCallback(async (name) => {
    try {
      await persistNamed(name, config);
      setSavedPresets((prev) => ({ ...prev, [name]: config }));
      setAppliedName(name);

      if (!defaultName || !savedPresets[defaultName]) {
        // No default yet → this new preset becomes the default.
        await persistDefaultName(name);
        setDefaultName(name);
      }
    } catch (e) {
      showToast(`שגיאה: ${e.message}`, 'error');
    }
  }, [config, persistNamed, persistDefaultName, defaultName, savedPresets, showToast]);

  /** Apply a saved preset (loads it into the editor). */
  const onLoadPreset = useCallback((name) => {
    const preset = savedPresets[name];
    if (!preset) return;
    setConfig(normalizeConfig(preset));
    setAppliedName(name);
  }, [savedPresets]);

  /** Delete a saved preset. Cascades through default + applied references. */
  const onDeletePreset = useCallback(async (name) => {
    try {
      const res = await fetch(
        `${API_BASE}/api/table-presets/${reportId}/saved/${encodeURIComponent(name)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // Compute new state synchronously so we can reset the editor accordingly.
      const newSaved = { ...savedPresets };
      delete newSaved[name];

      let newDefault = defaultName;
      if (defaultName === name) newDefault = null;

      let newApplied = appliedName;
      if (appliedName === name) newApplied = null;

      setSavedPresets(newSaved);
      setDefaultName(newDefault);
      setAppliedName(newApplied);

      // If the user was editing the deleted preset (or it was their fallback
      // target), snap the editor to the new fallback (default or EMPTY).
      if (appliedName === name || (!appliedName && defaultName === name)) {
        const fallbackName = newDefault && newSaved[newDefault] ? newDefault : null;
        setConfig(fallbackName ? normalizeConfig(newSaved[fallbackName]) : { ...EMPTY_CONFIG });
      }
    } catch (e) {
      showToast(`שגיאה: ${e.message}`, 'error');
    }
  }, [reportId, savedPresets, defaultName, appliedName, showToast]);

  /**
   * Rename a saved preset.
   *
   * The backend has no first-class rename endpoint, so we implement it as
   * (save-under-new-name + delete-old). The intermediate state on disk is
   * 'both present' for the moment between calls — harmless. After both
   * complete, the local maps are rewritten in one batched setState so the
   * UI never flashes the intermediate state.
   *
   * If the renamed preset was the report's default and/or the currently-
   * applied editor target, those references are forwarded to the new name.
   */
  const onRenamePreset = useCallback(async (oldName, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed)              return;
    if (trimmed === oldName)   return;
    if (!savedPresets[oldName]) return;
    if (savedPresets[trimmed]) {
      showToast(`קיימת תבנית בשם "${trimmed}"`, 'error');
      return;
    }
    try {
      const blob = savedPresets[oldName];
      // 1. Save under new name
      await persistNamed(trimmed, blob);
      // 2. Delete old name
      const res = await fetch(
        `${API_BASE}/api/table-presets/${reportId}/saved/${encodeURIComponent(oldName)}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 3. Forward the default reference if needed
      if (defaultName === oldName) {
        await persistDefaultName(trimmed);
      }

      // 4. Local state — one atomic-ish batch
      const nextSaved = { ...savedPresets, [trimmed]: blob };
      delete nextSaved[oldName];
      setSavedPresets(nextSaved);
      if (defaultName === oldName) setDefaultName(trimmed);
      if (appliedName === oldName) setAppliedName(trimmed);

      showToast(`התבנית "${oldName}" שונתה ל-"${trimmed}"`, 'success');
    } catch (e) {
      showToast(`שגיאה: ${e.message}`, 'error');
    }
  }, [reportId, savedPresets, defaultName, appliedName, persistNamed, persistDefaultName, showToast]);

  /** Reset editor to the resolved default preset (no server call). */
  const onResetToDefault = useCallback(() => {
    if (resolvedDefaultName) {
      setConfig(normalizeConfig(savedPresets[resolvedDefaultName]));
      setAppliedName(null);  // fall back to default via resolution
    } else {
      setConfig({ ...EMPTY_CONFIG });
      setAppliedName(null);
    }
  }, [resolvedDefaultName, savedPresets]);

  /** Set a saved preset as the report's default. */
  const onSetAsDefault = useCallback(async (name) => {
    if (!savedPresets[name]) return;
    try {
      await persistDefaultName(name);
      setDefaultName(name);
    } catch (e) {
      showToast(`שגיאה: ${e.message}`, 'error');
    }
  }, [savedPresets, persistDefaultName, showToast]);

  /* ================================================================
     Phase 3 — lineage-trace integration
     ================================================================ */

  // True iff the cell at (rowIndex, colIndex) carries an upstream-references
  // list. Used by AuditTable + PivotTable to: (a) light up the "this cell is
  // traceable" indicator, (b) gate the double-right-click trigger.
  const hasRefsAtCoord = useCallback((rowIndex, colIndex) => {
    if (!refsByCoord) return false;
    const refs = refsByCoord.get(`${colIndex},${rowIndex}`);
    return !!refs && refs.length > 0;
  }, [refsByCoord]);

  // Cell trace trigger — wires the AuditTable/PivotTable double-right-click
  // gesture into the global TraceContext. Re-triggering on the SAME
  // already-active cell DESELECTS (closes the trace screen and clears
  // the highlight), so a double-right-click also acts as "exit" in
  // table mode.
  const onCellTrace = useCallback((rowIndex, colIndex) => {
    const t = trace.panelTarget;
    if (t && t.reportId === reportId
        && t.columnIdx === colIndex
        && t.rowIdx === rowIndex) {
      trace.closeTrace();
      trace.clearFocus();
      return;
    }
    trace.openTraceFor({
      reportId,
      columnIdx: colIndex,
      rowIdx:    rowIndex,
    });
  }, [reportId, trace]);

  // Translate TraceContext.focusTarget into the (rowIndex, colIndex) shape
  // the tables expect, but only when the target lives in THIS report.
  const focusCoord = useMemo(() => {
    if (!trace.focusTarget) return null;
    if (trace.focusTarget.reportId !== reportId) return null;
    return {
      rowIndex: trace.focusTarget.rowIdx,
      colIndex: trace.focusTarget.columnIdx,
    };
  }, [trace.focusTarget, reportId]);

  // Set of `"rowIndex,colIndex"` cell keys that should be purple-marked in
  // THIS report. Exactly ONE cell — the current trace focus (the cell the
  // user opened the trace on, or the source cell they navigated to). We do
  // NOT light up every referenced sibling cell: that flooded the grid with
  // purple cells the user wasn't actually tracing. The source list lives in
  // the side panel; the grid marks only where you are.
  const highlightSet = useMemo(() => {
    const out = new Set();
    if (trace.focusTarget && trace.focusTarget.reportId === reportId) {
      out.add(`${trace.focusTarget.rowIdx},${trace.focusTarget.columnIdx}`);
    }
    return out;
  }, [trace.focusTarget, reportId]);

  // Permanent visibility fix — when the focused cell is in THIS report but
  // is currently hidden (column hidden / value filtered out / not in any
  // pivot zone), mutate the live config so it's visible. The change goes
  // through the standard setConfig path which preserves preset semantics.
  useEffect(() => {
    if (!focusCoord) return;
    if (!Array.isArray(columns) || columns.length === 0) return;
    const colName = columns[focusCoord.colIndex];
    if (!colName) return;
    const row = (data || [])[focusCoord.rowIndex];
    const cellValue = row ? row[colName] : undefined;

    setConfig((prev) => {
      let next = prev;

      // 1. Table mode: unhide the column if hidden.
      if (displayMode === 'table'
          && next.table
          && Array.isArray(next.table.hidden)
          && next.table.hidden.includes(colName)) {
        next = {
          ...next,
          table: {
            ...next.table,
            hidden: next.table.hidden.filter((c) => c !== colName),
          },
        };
      }

      // 2. Pivot mode: ensure the column is in some zone (default: values).
      if (displayMode === 'pivot') {
        const inRows    = (next.rows    || []).includes(colName);
        const inColumns = (next.columns || []).includes(colName);
        const inValues  = (next.values  || []).some((v) => v.field === colName);
        if (!inRows && !inColumns && !inValues) {
          next = {
            ...next,
            values: [...(next.values || []), { field: colName, aggregation: 'sum' }],
          };
        }
      }

      // 3. BOTH modes: if the cell value is in the column's excluded filter
      //    set, drop it so the row becomes visible. config.filters[col] is
      //    the pivot's "allowed values" array — add the missing value to it.
      const allowed = next.filters && next.filters[colName];
      if (Array.isArray(allowed)) {
        const asStr = cellValue == null ? '' : String(cellValue);
        if (!allowed.map(String).includes(asStr)) {
          next = {
            ...next,
            filters: {
              ...next.filters,
              [colName]: [...allowed, cellValue],
            },
          };
        }
      }

      return next;
    });
  }, [focusCoord, columns, data, displayMode, setConfig]);

  // (Auto-fade removed — the purple highlight now persists until the
  // user explicitly closes the trace screen or, in table mode, double-
  // right-clicks the same cell to deselect it.)

  return {
    loading,
    error,
    dataLoaded,
    columns,
    data,
    metadata,
    report,                         // raw Report block (status, exceptions, dependencies, etc.)
    refsByCoord,                    // Map<`colIdx,rowIdx`, references[]>
    columnFormulas,                 // { [colName]: formulaString }
    fxRates,
    config,
    setConfig,

    // Name-reference state
    savedPresets,
    defaultName: resolvedDefaultName,
    appliedName: resolvedAppliedName,

    // Operations
    onOverrideCurrent,
    onSaveNamed,
    onLoadPreset,
    onDeletePreset,
    onRenamePreset,
    onResetToDefault,
    onSetAsDefault,

    // Sidebar + display mode + table-mode zoom (UI state — global, persisted server-side)
    sidebarOpen,
    setSidebarOpen,
    // While the trace context forces a display mode (during ref-navigation
    // it pins to 'table'), that takes precedence — but the user's own
    // preferred mode is preserved underneath, and restored as soon as the
    // force clears.
    displayMode: trace.forcedDisplayMode || displayMode,
    setDisplayMode: setDisplayModePersisted,
    tableZoom,
    setTableZoom:   setTableZoomPersisted,
    exportFormat,
    setExportFormat: setExportFormatPersisted,

    uniqueValuesFor,
    toast,
    showToast,

    // Phase 3 — lineage-trace integration
    hasRefsAtCoord,    // (rowIndex, colIndex) → bool
    onCellTrace,       // (rowIndex, colIndex) — fired on cell double-right-click
    focusCoord,        // { rowIndex, colIndex } | null — primary trace target
    highlightSet,      // Set<`rowIdx,colIdx`> — all cells to mark purple
  };
}

function normalizeConfig(preset) {
  if (!preset) return { ...EMPTY_CONFIG, table: { ...EMPTY_TABLE } };
  const t = preset.table && typeof preset.table === 'object' ? preset.table : {};
  return {
    rows:           Array.isArray(preset.rows) ? [...preset.rows] : [],
    columns:        Array.isArray(preset.columns) ? [...preset.columns] : [],
    values:         Array.isArray(preset.values) ? preset.values.map((v) => ({ ...v })) : [],
    filters:        preset.filters && typeof preset.filters === 'object' ? { ...preset.filters } : {},
    fxConversions:  preset.fxConversions  && typeof preset.fxConversions  === 'object' ? { ...preset.fxConversions  } : {},
    thresholds:     preset.thresholds     && typeof preset.thresholds     === 'object' ? { ...preset.thresholds     } : {},
    statHighlights: preset.statHighlights && typeof preset.statHighlights === 'object' ? { ...preset.statHighlights } : {},
    deviations:     Array.isArray(preset.deviations) ? preset.deviations.map((d) => ({ ...d })) : [],
    expanded:       Array.isArray(preset.expanded) ? [...preset.expanded] : [],
    table: {
      columnOrder: Array.isArray(t.columnOrder) ? [...t.columnOrder] : [],
      hidden:      Array.isArray(t.hidden)      ? [...t.hidden]      : [],
      pinned:      Array.isArray(t.pinned)      ? [...t.pinned]      : [],
      sortBy:      t.sortBy && typeof t.sortBy === 'object' && t.sortBy.columnId
                     ? { columnId: t.sortBy.columnId,
                         direction: t.sortBy.direction === 'desc' ? 'desc' : 'asc' }
                     : null,
    },
  };
}
