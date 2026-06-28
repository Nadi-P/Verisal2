import { useState, useMemo, useCallback } from 'react';
import { isDeviationValueItem } from './DeviationColumns/DeviationColumns.logic.jsx';

/* ===================================================================
   Pure helpers — config manipulation
   =================================================================== */
function cloneConfig(cfg) {
  return {
    rows:       [...cfg.rows],
    columns:    [...(cfg.columns || [])],   // preserved for backward compat
    values:     cfg.values.map((v) => ({ ...v })),
    filters:    { ...cfg.filters },
    deviations: (cfg.deviations || []).map((d) => ({ ...d })),
  };
}

function removeFromAllZones(cfg, field) {
  cfg.rows    = cfg.rows.filter((f) => f !== field);
  cfg.columns = (cfg.columns || []).filter((f) => f !== field);
  cfg.values  = cfg.values.filter((v) => v.field !== field);
}

function addToZone(cfg, zone, field) {
  if (zone === 'values') {
    cfg.values.push({ field, aggregation: 'sum' });
  } else {
    cfg[zone].push(field);
  }
}

/**
 * When a deviation value entry is removed from values, flip the matching
 * checkbox off in config.deviations so the two-way binding holds.
 */
function untickDeviationFlag(cfg, deviationItem) {
  if (!deviationItem || !deviationItem.deviationId) return;
  const flag = deviationItem.kind === 'diff' ? 'showDiff' : 'showPercent';
  cfg.deviations = (cfg.deviations || []).map((d) =>
    d.id === deviationItem.deviationId ? { ...d, [flag]: false } : d
  );
}

/* ===================================================================
   Hook
   =================================================================== */
export function useEditPresetScreenLogic({ config, onConfigChange }) {
  /* ---- Set of fields already placed somewhere ---- */
  const usedFields = useMemo(() => {
    return new Set([
      ...config.rows,
      ...(config.columns || []),
      ...config.values.map((v) => v.field),
    ]);
  }, [config]);

  /* ---- Context menu state ---- */
  const [menu, setMenu] = useState(null);  // { x, y, zone, index }

  const openContextMenu = useCallback((e, zone, index) => {
    e.preventDefault();
    setMenu({ x: e.clientX, y: e.clientY, zone, index });
  }, []);

  const closeContextMenu = useCallback(() => setMenu(null), []);

  /* ---- Helpers to find a deviation value item by its synthetic field key ---- */
  const findDeviationItem = useCallback((field) => {
    return config.values.find((v) => isDeviationValueItem(v) && v.field === field) || null;
  }, [config.values]);

  /* ---- Drop handlers ---- */
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  /**
   * Generic drop handler for a zone.
   *
   *  - `src.field`   — the (synthetic for deviations, raw for normal) field id
   *  - `src.from`    — origin zone: 'rows' | 'values' | 'bank'
   *  - `src.index`   — origin index in src.from (when src.from is a zone)
   *  - `targetIndex` — optional insertion index inside the destination zone
   *                    (omitted => append). Comes from the drop indicator.
   *
   * Critical detail: when the dragged item is a deviation, we MUST preserve
   * the full `{ field, deviation: true, kind, deviationId, name }` shape on
   * re-insert. Earlier the values branch unconditionally did
   * `{ field, aggregation: 'sum' }`, stripping the deviation metadata —
   * which caused the cell to read undefined and the row to render the raw
   * `__dev_<id>_<kind>` synthetic key in the label area.
   */
  const handleDrop = useCallback((zone, src, targetIndex) => {
    const devItem = findDeviationItem(src.field);
    // Deviation items can only live in the Values zone — silently ignore
    // any attempt to drop them into Rows.
    if (devItem && zone !== 'values') return;

    const next = cloneConfig(config);
    removeFromAllZones(next, src.field);

    // Build the entry to insert.
    let entry;
    if (devItem) {
      // Preserve the full deviation entry verbatim (with its current name).
      entry = { ...devItem };
    } else if (zone === 'values') {
      entry = { field: src.field, aggregation: 'sum' };
    } else {
      entry = src.field;
    }

    const arr = next[zone];
    if (typeof targetIndex === 'number' && targetIndex >= 0 && targetIndex <= arr.length) {
      arr.splice(targetIndex, 0, entry);
    } else {
      arr.push(entry);
    }
    onConfigChange(next);
  }, [config, onConfigChange, findDeviationItem]);

  const handleDropToBank = useCallback((e) => {
    e.preventDefault();
    let src = null;
    try { src = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { /* ignore */ }
    if (!src || src.from === 'bank') return;

    const next = cloneConfig(config);
    const devItem = findDeviationItem(src.field);
    removeFromAllZones(next, src.field);
    if (devItem) untickDeviationFlag(next, devItem);
    onConfigChange(next);
  }, [config, onConfigChange, findDeviationItem]);

  /* ---- Zone item operations (context menu actions) ---- */
  const moveWithin = useCallback((zone, index, delta) => {
    const next = cloneConfig(config);
    const arr  = next[zone];
    const newIdx = Math.max(0, Math.min(arr.length - 1, index + delta));
    if (newIdx === index) return;
    const [item] = arr.splice(index, 1);
    arr.splice(newIdx, 0, item);
    onConfigChange(next);
  }, [config, onConfigChange]);

  const moveTo = useCallback((zone, index, target) => {
    const next = cloneConfig(config);
    const arr  = next[zone];
    const [item] = arr.splice(index, 1);
    if (target === 'start') arr.unshift(item);
    else if (target === 'end') arr.push(item);
    onConfigChange(next);
  }, [config, onConfigChange]);

  const transferTo = useCallback((fromZone, index, toZone) => {
    const arr  = config[fromZone];
    const item = arr[index];
    const field = typeof item === 'string' ? item : item.field;
    // Block transferring a deviation item out of the values zone.
    if (isDeviationValueItem(item) && toZone !== 'values') return;

    const next = cloneConfig(config);
    const nextArr = next[fromZone];
    nextArr.splice(index, 1);
    removeFromAllZones(next, field);
    addToZone(next, toZone, field);
    onConfigChange(next);
  }, [config, onConfigChange]);

  const removeItem = useCallback((zone, index) => {
    const next = cloneConfig(config);
    const [removed] = next[zone].splice(index, 1);
    if (zone === 'values' && isDeviationValueItem(removed)) {
      untickDeviationFlag(next, removed);
    }
    onConfigChange(next);
  }, [config, onConfigChange]);

  const setAggregation = useCallback((index, agg) => {
    const next = cloneConfig(config);
    // No-op on deviation entries — they don't have an aggregation.
    if (isDeviationValueItem(next.values[index])) return;
    next.values[index] = { ...next.values[index], aggregation: agg };
    onConfigChange(next);
  }, [config, onConfigChange]);

  return {
    usedFields,
    menu, openContextMenu, closeContextMenu,
    handleDragOver, handleDrop, handleDropToBank,
    moveWithin, moveTo, transferTo, removeItem, setAggregation,
  };
}
