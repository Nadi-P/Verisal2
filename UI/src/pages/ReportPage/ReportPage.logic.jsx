import { useState, useEffect, useCallback, useMemo, useRef } from 'react';

// Empty base = relative URLs → Vite dev server proxies /api/* to uvicorn.
const API_BASE = '';

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
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [dataLoaded, setDataLoaded] = useState(false);

  const [columns, setColumns] = useState([]);
  const [data, setData]       = useState([]);
  const [metadata, setMetadata] = useState(null);   // { company_name, min/max month+year }

  const [savedPresets, setSavedPresets] = useState({});
  const [defaultName, setDefaultName]   = useState(null);
  const [appliedName, setAppliedName]   = useState(null);
  const [config, setConfig]             = useState(EMPTY_CONFIG);

  const [fxRates, setFxRates] = useState({});

  // Sidebar open/closed — lifted here so the report top bar can toggle it.
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Global display settings (persisted server-side via /api/config/display-settings).
  // These survive across reports AND across app restarts — one mode + one zoom
  // for the whole app, exactly as the director asked.
  const [displayMode, setDisplayMode] = useState('pivot');
  const [tableZoom, setTableZoom]     = useState(100);

  // Hydrate once on mount; ignore failures (defaults already in place).
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/config/display-settings`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (cancelled || !body) return;
        if (body.mode === 'pivot' || body.mode === 'table') setDisplayMode(body.mode);
        if (Number.isFinite(body.zoom)) setTableZoom(body.zoom);
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

  /* ---- Load data + presets + fx rates ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [dataRes, presetRes, fxRes] = await Promise.all([
          fetch(`${API_BASE}/api/reports/${reportId}/data?page=0&size=10000`),
          fetch(`${API_BASE}/api/table-presets/${reportId}`),
          fetch(`${API_BASE}/api/config/fx`),
        ]);
        if (!dataRes.ok) throw new Error(`HTTP ${dataRes.status}`);
        const dataBody   = await dataRes.json();
        const presetBody = await presetRes.json();
        const fxBody     = fxRes.ok ? await fxRes.json() : {};

        if (cancelled) return;
        setColumns(dataBody.columns || []);
        setData(dataBody.rows || []);
        setDataLoaded(Boolean(dataBody.loaded));
        setMetadata(dataBody.metadata || null);

        const saved   = presetBody.saved || {};
        const defName = presetBody.defaultName || null;
        const startName = defName && saved[defName] ? defName : null;

        setSavedPresets(saved);
        setDefaultName(defName);
        setAppliedName(null);  // null falls back to defaultName via resolved
        setConfig(startName ? normalizeConfig(saved[startName]) : { ...EMPTY_CONFIG });

        setFxRates(fxBody || {});
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [reportId]);

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

  return {
    loading,
    error,
    dataLoaded,
    columns,
    data,
    metadata,
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
    displayMode,
    setDisplayMode: setDisplayModePersisted,
    tableZoom,
    setTableZoom:   setTableZoomPersisted,

    uniqueValuesFor,
    toast,
    showToast,
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
