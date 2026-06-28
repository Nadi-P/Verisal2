import React, { useState, useCallback } from 'react';
import { useDropZoneLogic, ZONE_LABELS, AGG_LABELS } from './DropZone.logic.jsx';
import './DropZone.css';

/**
 * A single drop zone (Rows or Values).
 *
 * Drag-and-drop:
 *   - Drag a field from the bank → drops at the hovered slot (or appends).
 *   - Drag an item INSIDE this zone → reorders to the hovered slot.
 *   - Drag an item out of another zone → moves it (same as before).
 *
 * The drop indicator is a thin accent-blue line that sits in the slot the
 * pointer is currently over, so users can see where the item will land
 * before releasing.
 *
 * Props:
 *   zone           — 'rows' | 'values'
 *   items          — for rows: ['fieldName', ...]; for values: [{field, aggregation}, ...]
 *   filters        — config.filters (used to badge fields that have an active filter)
 *   onDrop(zone, src, targetIndex)  — called when something is dropped here
 *   onContextMenu  — (event, zone, index) right-click on an item
 *   onDoubleClick  — (zone, index, field) double-click on an item → opens FieldConfig
 */
export default function DropZone({ zone, items, filters = {}, onDrop, onContextMenu, onDoubleClick }) {
  const L = useDropZoneLogic({ zone, onDrop });

  // ---- Drop-indicator state ------------------------------------------
  // hoverIndex = item index the pointer is currently over.
  // hoverWhere = 'before' | 'after' (which side of the item).
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverWhere, setHoverWhere] = useState('before');

  const onItemDragOver = useCallback((e, index) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    setHoverIndex(index);
    setHoverWhere(e.clientY < midpoint ? 'before' : 'after');
  }, []);

  const onListDragOver = useCallback((e) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    // If the pointer is over the list but not over any item, append at end.
    // The item-level handler resets hover state when it fires next.
  }, []);

  const onDragLeaveList = useCallback(() => {
    setHoverIndex(null);
  }, []);

  const resolveTargetIndex = useCallback(() => {
    if (hoverIndex === null) return items.length;            // append
    return hoverWhere === 'before' ? hoverIndex : hoverIndex + 1;
  }, [hoverIndex, hoverWhere, items.length]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    let src = null;
    try { src = JSON.parse(e.dataTransfer.getData('text/plain')); } catch { /* ignore */ }
    if (!src) return;
    let target = resolveTargetIndex();

    // If reordering within the same zone, account for the gap left by
    // removing the source item before re-inserting.
    if (src.from === zone && typeof src.index === 'number' && target > src.index) {
      target -= 1;
    }

    onDrop?.(zone, src, target);
    setHoverIndex(null);
  }, [zone, onDrop, resolveTargetIndex]);

  return (
    <div className="drop-zone">
      <div className="drop-zone-label">{ZONE_LABELS[zone]}</div>
      <div
        className="drop-zone-list"
        onDragOver={onListDragOver}
        onDragLeave={onDragLeaveList}
        onDrop={handleDrop}
      >
        {items.length === 0 ? (
          <div className="drop-zone-empty">גרור שדה לכאן</div>
        ) : (
          items.map((item, i) => {
            const field = typeof item === 'string' ? item : item.field;
            const isDev = typeof item === 'object' && item !== null && item.deviation === true;
            const agg   = isDev || typeof item === 'string' ? null : item.aggregation;
            const hasFilter = filters[field] !== undefined;
            const label = isDev
              ? `${item.name || '—'}${item.kind === 'percent' ? ' %' : ''}`
              : field;
            const indicatorBefore = hoverIndex === i && hoverWhere === 'before';
            const indicatorAfter  = hoverIndex === i && hoverWhere === 'after';
            return (
              <React.Fragment key={`${field}-${i}`}>
                {indicatorBefore && <div className="drop-zone-indicator" />}
                <div
                  className={[
                    'drop-zone-item',
                    hasFilter ? 'has-filter' : '',
                    isDev ? 'is-deviation' : '',
                  ].filter(Boolean).join(' ')}
                  draggable
                  onDragStart={(e) => L.handleItemDragStart(e, field, i)}
                  onDragOver={(e) => onItemDragOver(e, i)}
                  onContextMenu={(e) => onContextMenu?.(e, zone, i)}
                  onDoubleClick={() => onDoubleClick?.(zone, i, field)}
                  title="לחיצה כפולה: הגדרות שדה"
                >
                  <span className="drop-zone-item-label">{label}</span>
                  {agg && <span className="drop-zone-item-agg">{AGG_LABELS[agg]}</span>}
                  {hasFilter && <span className="drop-zone-item-filter" title="מסונן">⚐</span>}
                </div>
                {indicatorAfter && <div className="drop-zone-indicator" />}
              </React.Fragment>
            );
          })
        )}
      </div>
    </div>
  );
}
