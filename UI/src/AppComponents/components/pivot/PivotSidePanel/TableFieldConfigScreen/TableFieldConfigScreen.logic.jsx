import { useCallback, useMemo } from 'react';

const DEV_FIELD_PREFIX = '__dev_';

/**
 * Per-column controls for table-mode field config.
 *
 * Reads/writes:
 *   visible : !config.table.hidden.includes(field)
 *   pinned  :  config.table.pinned.includes(field)
 *   sort    :  config.table.sortBy.{ direction } when columnId matches
 *   filter  :  config.filters[field]            — SHARED with pivot mode
 *   fx      :  config.fxConversions[field]      — SHARED with pivot mode
 *
 * Deviations are derived; their FX section is hidden (mirrors pivot's rule).
 */
export function useTableFieldConfigScreenLogic({ field, config, onConfigChange }) {
  const table       = config.table || { hidden: [], pinned: [], columnOrder: [], sortBy: null };
  const isDeviation = !!field && field.startsWith(DEV_FIELD_PREFIX);

  const visible = !(table.hidden || []).includes(field);
  const pinned  =  (table.pinned || []).includes(field);
  const sortDir = table.sortBy && table.sortBy.columnId === field ? table.sortBy.direction : null;

  const filter        = (config.filters       || {})[field];
  const fx            = (config.fxConversions || {})[field];
  const threshold     = (config.thresholds    || {})[field];
  const statHighlight = (config.statHighlights|| {})[field];

  const updateTable = useCallback((partial) => {
    onConfigChange({ ...config, table: { ...table, ...partial } });
  }, [config, table, onConfigChange]);

  const toggleVisible = useCallback(() => {
    if (visible) {
      // Hide also unpins.
      updateTable({
        hidden: [...(table.hidden || []), field],
        pinned: (table.pinned || []).filter((c) => c !== field),
      });
    } else {
      updateTable({ hidden: (table.hidden || []).filter((c) => c !== field) });
    }
  }, [visible, field, table.hidden, table.pinned, updateTable]);

  const togglePin = useCallback(() => {
    if (pinned) {
      updateTable({ pinned: (table.pinned || []).filter((c) => c !== field) });
    } else {
      // Pin also forces visible + moves to top of order.
      const nextPinned = [...(table.pinned || []), field];
      const order      = (table.columnOrder || []);
      const remaining  = order.filter((c) => c !== field);
      // place this column right after the last currently-pinned item
      const pinnedSet  = new Set(nextPinned);
      const pinnedSeg  = remaining.filter((c) => pinnedSet.has(c));
      const otherSeg   = remaining.filter((c) => !pinnedSet.has(c));
      updateTable({
        pinned: nextPinned,
        hidden: (table.hidden || []).filter((c) => c !== field),
        columnOrder: [...pinnedSeg, field, ...otherSeg],
      });
    }
  }, [pinned, field, table.pinned, table.hidden, table.columnOrder, updateTable]);

  const cycleSort = useCallback((dir = 'forward') => {
    let next;
    if (dir === 'forward') {
      if (sortDir === null)      next = 'asc';
      else if (sortDir === 'asc') next = 'desc';
      else                        next = null;
    } else {
      if (sortDir === null)       next = 'desc';
      else if (sortDir === 'desc') next = 'asc';
      else                         next = null;
    }
    updateTable({ sortBy: next ? { columnId: field, direction: next } : null });
  }, [sortDir, field, updateTable]);

  /* ---- Shared (filter / fx) ------------------------------------------ */

  const cloneShared = useMemo(() => () => ({
    rows:           [...(config.rows || [])],
    columns:        [...(config.columns || [])],
    values:         (config.values || []).map((v) => ({ ...v })),
    filters:        { ...(config.filters || {}) },
    fxConversions:  { ...(config.fxConversions || {}) },
    thresholds:     { ...(config.thresholds || {}) },
    statHighlights: { ...(config.statHighlights || {}) },
    deviations:     (config.deviations || []).map((d) => ({ ...d })),
    table:          { ...(config.table || {}) },
  }), [config]);

  const setFilter = useCallback((nextSelection) => {
    const next = cloneShared();
    if (nextSelection === undefined) delete next.filters[field];
    else next.filters[field] = nextSelection;
    onConfigChange(next);
  }, [cloneShared, field, onConfigChange]);

  const setFx = useCallback((nextFx) => {
    const next = cloneShared();
    if (nextFx === null) delete next.fxConversions[field];
    else next.fxConversions[field] = nextFx;
    onConfigChange(next);
  }, [cloneShared, field, onConfigChange]);

  const setThreshold = useCallback((nextThreshold) => {
    const next = cloneShared();
    if (nextThreshold === null) delete next.thresholds[field];
    else next.thresholds[field] = nextThreshold;
    onConfigChange(next);
  }, [cloneShared, field, onConfigChange]);

  const setStatHighlight = useCallback((nextStat) => {
    const next = cloneShared();
    if (nextStat === null) delete next.statHighlights[field];
    else next.statHighlights[field] = nextStat;
    onConfigChange(next);
  }, [cloneShared, field, onConfigChange]);

  // Clear both at once — see the FieldConfigScreen.logic comment.
  const clearConditional = useCallback(() => {
    const next = cloneShared();
    delete next.thresholds[field];
    delete next.statHighlights[field];
    onConfigChange(next);
  }, [cloneShared, field, onConfigChange]);

  return {
    isDeviation,
    visible, pinned, sortDir,
    toggleVisible, togglePin, cycleSort,
    filter, setFilter,
    fx, setFx,
    threshold, setThreshold,
    statHighlight, setStatHighlight,
    clearConditional,
  };
}
