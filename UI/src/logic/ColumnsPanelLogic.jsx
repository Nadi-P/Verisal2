import { useState, useEffect, useCallback, useMemo } from 'react';

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

  // Select All / Deselect All
  const allVisible = useMemo(() => localColumns.length > 0 && localColumns.every(c => c.visible), [localColumns]);

  const handleToggleAll = useCallback(() => {
    setLocalColumns(prev =>
      prev.map(c => ({
        ...c,
        visible: !allVisible,
        // If hiding all, also unpin
        pinned: !allVisible ? c.pinned : false,
      }))
    );
  }, [allVisible]);

  // Disable Apply when no columns are visible
  const canApply = useMemo(() => localColumns.some(c => c.visible), [localColumns]);

  const handleApply = useCallback(() => {
    if (!canApply) return;
    // Do NOT reorder: preserve the original column order forever.
    // Pinning is just a flag — the AuditTable computes the display order
    // (pinned first, then unpinned, both in original order). This way
    // unpinning naturally returns a column to its original slot.
    onApply(localColumns);
  }, [localColumns, onApply, canApply]);

  const handleCancel = useCallback(() => {
    setLocalColumns(columns.map(c => ({ ...c })));
    onCancel();
  }, [columns, onCancel]);

  return {
    localColumns,
    handleToggleVisible,
    handleTogglePin,
    handleToggleAll,
    allVisible,
    canApply,
    handleApply,
    handleCancel,
  };
}
