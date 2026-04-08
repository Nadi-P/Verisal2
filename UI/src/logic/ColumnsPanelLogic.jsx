import { useState, useEffect, useCallback } from 'react';

export function useColumnsPanel(columns, onApply, onCancel) {
  const [localColumns, setLocalColumns] = useState([]);

  // Sync when the panel opens or columns change
  useEffect(() => {
    setLocalColumns(columns.map(c => ({ ...c })));
  }, [columns]);

  const handleToggleVisible = useCallback((index) => {
    setLocalColumns(prev => {
      const next = [...prev];
      next[index] = { ...next[index], visible: !next[index].visible };
      // If hiding, also unpin
      if (!next[index].visible) next[index].pinned = false;
      return next;
    });
  }, []);

  const handleTogglePin = useCallback((index) => {
    setLocalColumns(prev => {
      const next = [...prev];
      const col = next[index];
      next[index] = { ...col, pinned: !col.pinned };
      // If pinning, ensure visible
      if (next[index].pinned) next[index].visible = true;
      return next;
    });
  }, []);

  const handleApply = useCallback(() => {
    // Reorder: pinned columns first (in their pin order), then the rest in original order
    const pinned = localColumns.filter(c => c.pinned);
    const unpinned = localColumns.filter(c => !c.pinned);
    onApply([...pinned, ...unpinned]);
  }, [localColumns, onApply]);

  const handleCancel = useCallback(() => {
    setLocalColumns(columns.map(c => ({ ...c })));
    onCancel();
  }, [columns, onCancel]);

  return {
    localColumns,
    handleToggleVisible,
    handleTogglePin,
    handleApply,
    handleCancel,
  };
}
