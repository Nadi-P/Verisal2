import { useState, useMemo, useCallback } from 'react';

/**
 * Bank of fields not currently used by any zone. Search-filtered.
 */
export function useFieldBankLogic({ allFields, usedFields }) {
  const [query, setQuery] = useState('');

  const availableFields = useMemo(() => {
    const lower = query.toLowerCase();
    return allFields
      .filter((f) => !usedFields.has(f))
      .filter((f) => f.toLowerCase().includes(lower));
  }, [allFields, usedFields, query]);

  const handleDragStart = useCallback((e, field) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ field, from: 'bank' }));
  }, []);

  return { query, setQuery, availableFields, handleDragStart };
}
