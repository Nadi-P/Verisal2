import { useState, useMemo, useCallback } from 'react';

/**
 * Manages the local search box and translates check/uncheck into filter updates.
 *
 * filter shape:
 *   undefined  → all values pass (no active filter)
 *   string[]   → only listed values pass
 */
export function useValueFilterLogic({ uniqueValues, filter, onChange }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const lower = query.toLowerCase();
    return uniqueValues.filter((v) => String(v).toLowerCase().includes(lower));
  }, [uniqueValues, query]);

  const isAllSelected = filter === undefined;

  const isSelected = useCallback((v) => {
    if (isAllSelected) return true;
    return filter.includes(v);
  }, [isAllSelected, filter]);

  const toggle = useCallback((v) => {
    let selected = isAllSelected ? new Set(uniqueValues) : new Set(filter);
    if (selected.has(v)) selected.delete(v);
    else selected.add(v);
    // Treat "everything selected" as no filter
    if (selected.size === uniqueValues.length) onChange(undefined);
    else onChange(Array.from(selected));
  }, [isAllSelected, uniqueValues, filter, onChange]);

  const selectAll = useCallback(() => onChange(undefined), [onChange]);
  const clearAll  = useCallback(() => onChange([]), [onChange]);

  return {
    query, setQuery,
    filtered,
    isSelected, isAllSelected,
    toggle, selectAll, clearAll,
  };
}
