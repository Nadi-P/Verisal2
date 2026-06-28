import { useState, useEffect, useMemo, useCallback } from 'react';

/**
 * Filter is stored as an EXCLUDED set — the values the user unchecked.
 * This lets filters apply across reports gracefully: values that didn't exist
 * when the filter was created are treated as "kept" by default, since they
 * are not in the excluded set.
 *
 * `currentFilter` is that excluded Set<string> (or undefined/empty).
 */
export function useFilterMenu(allValues, currentFilter, onApply) {
  // checked[i] = boolean — is the i-th value (in allValues) currently kept?
  const [checked, setChecked] = useState([]);

  useEffect(() => {
    setChecked(allValues.map((v) => {
      if (!currentFilter || currentFilter.size === 0) return true;
      return !currentFilter.has(String(v));
    }));
  }, [allValues, currentFilter]);

  const allChecked = useMemo(
    () => checked.length > 0 && checked.every(Boolean),
    [checked]
  );

  const hasAnyChecked = useMemo(
    () => checked.some(Boolean),
    [checked]
  );

  const handleToggle = useCallback((index) => {
    setChecked((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    const newVal = !allChecked;
    setChecked(allValues.map(() => newVal));
  }, [allChecked, allValues]);

  const handleApply = useCallback(() => {
    if (!checked.some(Boolean)) return;
    // Start from the existing excluded set so exclusions from OTHER reports
    // (values not present in allValues here) are preserved across reports.
    const excluded = new Set(currentFilter || []);
    allValues.forEach((v, i) => {
      const key = String(v);
      if (checked[i]) {
        excluded.delete(key);
      } else {
        excluded.add(key);
      }
    });
    onApply(excluded);
  }, [allValues, checked, onApply, currentFilter]);

  return {
    checked,
    allChecked,
    hasAnyChecked,
    handleToggle,
    handleSelectAll,
    handleApply,
  };
}
