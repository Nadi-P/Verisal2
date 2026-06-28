import { useCallback, useMemo } from 'react';

/**
 * Logic for the table-mode edit screen.
 *
 * Source of truth lives on `config.table`:
 *   columnOrder : string[]          — full pinned-then-unpinned order
 *   hidden      : string[]          — hidden column ids
 *   pinned      : string[]          — pinned column ids (subset of columnOrder)
 *   sortBy      : { columnId, direction } | null
 *
 * The screen takes `allFields` (the column ids the report exposes) + the
 * synthetic deviation field ids and reconciles them with the persisted
 * `columnOrder`:
 *   - Columns present in the report but missing from columnOrder are appended.
 *   - Columns present in columnOrder but no longer in the report (e.g. data
 *     reshape) are dropped silently.
 *
 * All edits go through `updateTable(partial)` which writes back to the
 * parent via `onConfigChange`.
 */
export function useTableEditScreenLogic({ allFields, deviationFields, config, onConfigChange }) {
  const table = config.table || { columnOrder: [], hidden: [], pinned: [], sortBy: null };

  // Reconcile: every visible column from the report + every deviation field
  // becomes a candidate. The order is dictated by columnOrder, with newcomers
  // appended at the end (or right after the last pinned column if pin-status
  // says so).
  const reconciledOrder = useMemo(() => {
    const inputs = [...allFields, ...deviationFields];
    const present = new Set(inputs);
    const persisted = (table.columnOrder || []).filter((c) => present.has(c));
    const persistedSet = new Set(persisted);
    const missing = inputs.filter((c) => !persistedSet.has(c));
    return [...persisted, ...missing];
  }, [allFields, deviationFields, table.columnOrder]);

  const pinnedSet = useMemo(() => new Set(table.pinned || []), [table.pinned]);
  const hiddenSet = useMemo(() => new Set(table.hidden || []), [table.hidden]);

  // Decorated list view consumed by the screen: pinned items float to the
  // top, both segments preserve their persisted order.
  const items = useMemo(() => {
    const pinned   = reconciledOrder.filter((c) => pinnedSet.has(c));
    const unpinned = reconciledOrder.filter((c) => !pinnedSet.has(c));
    const ordered  = [...pinned, ...unpinned];
    const devSet   = new Set(deviationFields);
    return ordered.map((id) => ({
      id,
      visible:    !hiddenSet.has(id),
      pinned:     pinnedSet.has(id),
      deviation:  devSet.has(id),
    }));
  }, [reconciledOrder, pinnedSet, hiddenSet, deviationFields]);

  const updateTable = useCallback((partial) => {
    onConfigChange({
      ...config,
      table: { ...table, ...partial },
    });
  }, [config, table, onConfigChange]);

  /* ---- Per-column mutators -------------------------------------------- */

  const togglePin = useCallback((id) => {
    const nextPinned = pinnedSet.has(id)
      ? (table.pinned || []).filter((c) => c !== id)
      : [...(table.pinned || []), id];
    // Pinning also forces visible
    let nextHidden = table.hidden || [];
    if (!pinnedSet.has(id) && hiddenSet.has(id)) {
      nextHidden = nextHidden.filter((c) => c !== id);
    }
    // Update columnOrder so the newly pinned column moves above unpinned items.
    const nextPinnedSet = new Set(nextPinned);
    const pinned   = reconciledOrder.filter((c) => nextPinnedSet.has(c));
    const unpinned = reconciledOrder.filter((c) => !nextPinnedSet.has(c));
    updateTable({
      pinned:      nextPinned,
      hidden:      nextHidden,
      columnOrder: [...pinned, ...unpinned],
    });
  }, [pinnedSet, hiddenSet, table.pinned, table.hidden, reconciledOrder, updateTable]);

  const toggleVisible = useCallback((id) => {
    if (hiddenSet.has(id)) {
      updateTable({ hidden: (table.hidden || []).filter((c) => c !== id) });
    } else {
      // Hiding also unpins
      const nextPinned = (table.pinned || []).filter((c) => c !== id);
      updateTable({
        hidden: [...(table.hidden || []), id],
        pinned: nextPinned,
      });
    }
  }, [hiddenSet, table.hidden, table.pinned, updateTable]);

  /**
   * Cycle sort state for `id` in either direction:
   *   forward: null → asc → desc → null
   *   back:    null → desc → asc → null
   */
  const cycleSort = useCallback((id, dir = 'forward') => {
    const cur = table.sortBy && table.sortBy.columnId === id ? table.sortBy.direction : null;
    let next;
    if (dir === 'forward') {
      if (cur === null)        next = 'asc';
      else if (cur === 'asc')  next = 'desc';
      else                     next = null;
    } else {
      if (cur === null)        next = 'desc';
      else if (cur === 'desc') next = 'asc';
      else                     next = null;
    }
    updateTable({ sortBy: next ? { columnId: id, direction: next } : null });
  }, [table.sortBy, updateTable]);

  /**
   * Drag-to-reorder. `from` and `to` are indices into the rendered `items`
   * list. Pinning rule:
   *   - A pinned item can only be dropped within the pinned segment
   *     (never crossing into unpinned).
   *   - An unpinned item can only be dropped within the unpinned segment.
   * Invalid drops are silently rejected.
   */
  const moveItem = useCallback((from, to) => {
    if (from === to) return;
    const order   = items.map((it) => it.id);
    const moving  = items[from];
    if (!moving) return;
    const pinnedCount = items.filter((it) => it.pinned).length;
    // Segment bounds
    const lowerBound = moving.pinned ? 0 : pinnedCount;
    const upperBound = moving.pinned ? pinnedCount - 1 : items.length - 1;
    if (to < lowerBound || to > upperBound) return;

    const next = [...order];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    updateTable({ columnOrder: next });
  }, [items, updateTable]);

  /**
   * Force-set a column's sort direction. `dir` is one of 'asc' | 'desc' |
   * null. Pass null to cancel sorting.
   */
  const setSortDirect = useCallback((id, dir) => {
    updateTable({ sortBy: dir ? { columnId: id, direction: dir } : null });
  }, [updateTable]);

  /**
   * Convenience wrapper around `moveItem` that takes the column id and a
   * signed delta (-1 = up, +1 = down). Respects the same pinned/unpinned
   * segment rules as `moveItem`. Returns true when the move was applied.
   */
  const moveItemBy = useCallback((id, delta) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return false;
    moveItem(idx, idx + delta);
    return true;
  }, [items, moveItem]);

  /**
   * Bounds inspection for the column-list right-click menu — tells the
   * caller whether move-up / move-down are valid for this id, factoring
   * in segment boundaries (pinned items can't cross into the unpinned
   * segment and vice-versa).
   */
  const moveBoundsFor = useCallback((id) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx === -1) return { canUp: false, canDown: false };
    const it = items[idx];
    const pinnedCount = items.filter((x) => x.pinned).length;
    const segStart = it.pinned ? 0 : pinnedCount;
    const segEnd   = it.pinned ? pinnedCount - 1 : items.length - 1;
    return {
      canUp:   idx > segStart,
      canDown: idx < segEnd,
    };
  }, [items]);

  return {
    items,            // [{ id, visible, pinned, deviation }, ...]
    sortBy:    table.sortBy,
    togglePin,
    toggleVisible,
    cycleSort,
    setSortDirect,
    moveItem,
    moveItemBy,
    moveBoundsFor,
  };
}
