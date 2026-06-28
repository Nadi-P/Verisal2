import { useCallback } from 'react';

export const ZONE_LABELS = {
  rows:   'שורות',
  values: 'ערכים',
};

export const AGG_LABELS = {
  sum:   'סכום',
  avg:   'ממוצע',
  count: 'ספירה',
  min:   'מינימום',
  max:   'מקסימום',
  first: 'ראשון',
};

/**
 * Per-zone drag-start + drop logic.
 */
export function useDropZoneLogic({ zone, onDrop }) {
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    let src = null;
    try {
      src = JSON.parse(e.dataTransfer.getData('text/plain'));
    } catch { /* ignore */ }
    if (!src) return;
    onDrop?.(zone, src);
  }, [zone, onDrop]);

  const handleItemDragStart = useCallback((e, field, index) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ field, from: zone, index }));
  }, [zone]);

  return { handleDragOver, handleDrop, handleItemDragStart };
}
