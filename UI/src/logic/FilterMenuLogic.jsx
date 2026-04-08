import { useState, useEffect, useMemo, useCallback } from 'react';

export function useFilterMenu(allValues, currentFilter, onApply) {
  // checked[i] = boolean
  const [checked, setChecked] = useState([]);

  useEffect(() => {
    setChecked(allValues.map(v => {
      if (!currentFilter || currentFilter.size === 0) return true;
      return currentFilter.has(String(v));
    }));
  }, [allValues, currentFilter]);

  const allChecked = useMemo(() => checked.length > 0 && checked.every(Boolean), [checked]);

  const handleToggle = useCallback((index) => {
    setChecked(prev => {
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
    const selectedValues = new Set();
    allValues.forEach((v, i) => {
      if (checked[i]) selectedValues.add(String(v));
    });
    onApply(selectedValues);
  }, [allValues, checked, onApply]);

  return {
    checked,
    allChecked,
    handleToggle,
    handleSelectAll,
    handleApply,
  };
}
