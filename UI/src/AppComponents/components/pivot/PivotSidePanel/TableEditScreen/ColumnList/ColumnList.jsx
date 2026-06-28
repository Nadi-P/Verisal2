import React, { useState, useRef, useCallback } from 'react';
import {
  IconPin, IconPinOff,
  IconSortAsc, IconSortDesc,
  IconGrip,
} from '../../../../icons.jsx';
import ColumnListContextMenu from './ColumnListContextMenu.jsx';
import './ColumnList.css';

/**
 * Draggable column list for table-mode editing.
 *
 * Drag rules (enforced by the parent's `onMoveItem`):
 *   - Pinned items live at the top in their persisted order.
 *   - A pinned item can only swap with other pinned items.
 *   - An unpinned item can only swap with other unpinned items.
 *   - When only one pinned item exists it's effectively undraggable.
 *
 * The drop-indicator (a horizontal accent-blue line) renders at the slot the
 * mouse is currently hovering over, so the user can see where the item will
 * land before releasing.
 *
 * Clicking a row (anywhere outside the pin button) opens the per-column
 * config screen.
 */
export default function ColumnList({
  items,
  sortBy,
  labelFor,
  dragDisabled = false,
  onTogglePin,
  onToggleVisible,   // (id) — flip hide/show; optional, no-op if absent
  onMoveItem,
  onMoveItemBy,
  onSetSortDirect,
  onClickItem,
  onOpenFilter,    // (columnId, position) — parent owns the FilterMenu render
}) {
  // ---- Right-click context menu state (per-row) ----------------------
  const [ctxMenu, setCtxMenu] = useState(null);
  // shape: { id, position: { top, left } }

  const openCtxMenu = useCallback((id, e) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ id, position: { top: e.clientY, left: e.clientX } });
  }, []);
  const closeCtxMenu = useCallback(() => setCtxMenu(null), []);
  // Indices into `items` for the row currently being dragged + the row the
  // pointer is currently over. `hoverIndex` is what's used to position the
  // drop indicator.
  const [dragIndex,  setDragIndex]  = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverWhere, setHoverWhere] = useState('before');   // 'before' | 'after'

  const handleDragStart = useCallback((e, index, isDraggable) => {
    if (!isDraggable) {
      e.preventDefault();
      return;
    }
    setDragIndex(index);
    // Required for Firefox to fire dragover.
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(index)); } catch { /* ignore */ }
    }
  }, []);

  const handleDragOver = useCallback((e, index) => {
    if (dragIndex === null) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const where = e.clientY < midpoint ? 'before' : 'after';
    setHoverIndex(index);
    setHoverWhere(where);
  }, [dragIndex]);

  const handleDragEnd = useCallback(() => {
    if (dragIndex !== null && hoverIndex !== null) {
      // Resolve drop position to an insertion index.
      let target = hoverWhere === 'before' ? hoverIndex : hoverIndex + 1;
      if (target > dragIndex) target -= 1;
      onMoveItem(dragIndex, Math.max(0, target));
    }
    setDragIndex(null);
    setHoverIndex(null);
    setHoverWhere('before');
  }, [dragIndex, hoverIndex, hoverWhere, onMoveItem]);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    handleDragEnd();
  }, [handleDragEnd]);

  // Determine whether each item is currently draggable based on segment size.
  // A pinned item is draggable only when there are ≥2 pinned items.
  // An unpinned item is draggable only when there are ≥2 unpinned items.
  const pinnedCount   = items.filter((it) => it.pinned).length;
  const unpinnedCount = items.length - pinnedCount;

  return (
    <div className="column-list-container">
      <div className="column-list" onDragOver={(e) => e.preventDefault()} onDrop={handleDrop}>
        {items.map((it, index) => {
          const isPinned       = it.pinned;
          const isDeviation    = it.deviation;
          const hidden         = !it.visible;
          const isSortedAsc    = sortBy && sortBy.columnId === it.id && sortBy.direction === 'asc';
          const isSortedDesc   = sortBy && sortBy.columnId === it.id && sortBy.direction === 'desc';
          // Drag is also globally suppressed whenever the parent has a live
          // search query — reorder operations target the persisted list, so
          // dragging a filtered-down subset would produce surprising results.
          const isDraggable    = !dragDisabled
                                  && (isPinned ? pinnedCount > 1 : unpinnedCount > 1);
          const isBeingDragged = dragIndex === index;

          const showIndicatorBefore = hoverIndex === index && hoverWhere === 'before' && dragIndex !== null;
          const showIndicatorAfter  = hoverIndex === index && hoverWhere === 'after'  && dragIndex !== null;

          const cls = [
            'column-list-item',
            isPinned    ? 'is-pinned'    : '',
            isDeviation ? 'is-deviation' : '',
            hidden      ? 'is-hidden'    : '',
            isBeingDragged ? 'is-dragging' : '',
            !isDraggable   ? 'is-locked'   : '',
          ].filter(Boolean).join(' ');

          return (
            <React.Fragment key={it.id}>
              {showIndicatorBefore && <div className="column-list-indicator" />}
              <div
                className={cls}
                draggable={isDraggable}
                onDragStart={(e) => handleDragStart(e, index, isDraggable)}
                onDragOver={(e)  => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onClick={() => onClickItem(it.id)}
                onContextMenu={(e) => openCtxMenu(it.id, e)}
              >
                <span className="column-list-grip" aria-hidden="true">
                  {isDraggable ? <IconGrip size={14} /> : null}
                </span>

                <span className="column-list-label" title={labelFor(it.id)}>
                  {labelFor(it.id)}
                </span>

                <span className="column-list-status">
                  {isSortedAsc  && <IconSortAsc  size={12} />}
                  {isSortedDesc && <IconSortDesc size={12} />}
                </span>

                <button
                  className={`column-list-pin ${isPinned ? 'pinned' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onTogglePin(it.id); }}
                  title={isPinned ? 'בטל הקפאה' : 'הקפא עמודה'}
                >
                  {isPinned ? <IconPin size={14} /> : <IconPinOff size={14} />}
                </button>
              </div>
              {showIndicatorAfter && <div className="column-list-indicator" />}
            </React.Fragment>
          );
        })}

        {ctxMenu && (() => {
          const item    = items.find((it) => it.id === ctxMenu.id);
          const idx     = items.findIndex((it) => it.id === ctxMenu.id);
          if (!item || idx === -1) return null;
          const pCount  = pinnedCount;
          const segStart = item.pinned ? 0 : pCount;
          const segEnd   = item.pinned ? pCount - 1 : items.length - 1;
          const sortDir =
            sortBy && sortBy.columnId === item.id ? sortBy.direction : null;
          return (
            <ColumnListContextMenu
              position={ctxMenu.position}
              pinned={item.pinned}
              sortDir={sortDir}
              canMoveUp={idx > segStart}
              canMoveDown={idx < segEnd}
              isDeviation={item.deviation}
              onMoveUp={()    => onMoveItemBy?.(item.id, -1)}
              onMoveDown={()  => onMoveItemBy?.(item.id, +1)}
              visible={!!item.visible}
              onPinToggle={()  => onTogglePin(item.id)}
              onHideToggle={() => onToggleVisible && onToggleVisible(item.id)}
              onFilter={()     => onOpenFilter?.(item.id, ctxMenu.position)}
              onSortAsc={()    => onSetSortDirect?.(item.id, 'asc')}
              onSortDesc={()   => onSetSortDirect?.(item.id, 'desc')}
              onCancelSort={() => onSetSortDirect?.(item.id, null)}
              onClose={closeCtxMenu}
            />
          );
        })()}
      </div>
    </div>
  );
}
