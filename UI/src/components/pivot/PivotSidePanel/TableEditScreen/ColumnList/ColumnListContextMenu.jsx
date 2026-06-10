import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  IconPin, IconPinOff,
  IconSortAsc, IconSortDesc, IconSortNone,
  IconChevronDown, IconBack,
} from '../../../../icons.jsx';
import './ColumnListContextMenu.css';

/**
 * Right-click menu for a row inside the table-mode column list.
 *
 * Items (in display order):
 *   - Move up                  (disabled at the top of its segment)
 *   - Move down                (disabled at the bottom of its segment)
 *   - Pin / Unpin              (label + icon flip with state)
 *   - Filter                   (hidden for deviation rows — no raw values)
 *   - Sort ascending
 *   - Sort descending
 *   - Cancel sort              (disabled when column is not the sort target)
 *
 * Positioning + dismissal mirror the header context menu in `components/table/`:
 *   - Portal to body so the side-panel's overflow can't clip it.
 *   - Bottom-left of the menu lands at the click point (measured + adjusted
 *     in a `useLayoutEffect`-like rAF after the menu has mounted).
 *   - Closes on outside click or Escape.
 */
export default function ColumnListContextMenu({
  position,        // { top, left } — click point in viewport coords
  pinned,
  sortDir,         // 'asc' | 'desc' | null
  canMoveUp,
  canMoveDown,
  isDeviation,
  onMoveUp,
  onMoveDown,
  onPinToggle,
  onFilter,
  onSortAsc,
  onSortDesc,
  onCancelSort,
  onClose,
}) {
  useEffect(() => {
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('.column-list-context-menu')) return;
      onClose();
    };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  // Anchor "bottom-left at click" via translateY(-100%). Browsers handle
  // this fine on portaled fixed-position elements.
  return createPortal(
    <div
      className="column-list-context-menu"
      style={{ top: position.top, left: position.left }}
    >
      <button
        className="clcm-item"
        onClick={() => { onMoveUp(); onClose(); }}
        disabled={!canMoveUp}
      >
        <IconChevronDown size={14} className="clcm-flip" />
        <span>הזז למעלה</span>
      </button>

      <button
        className="clcm-item"
        onClick={() => { onMoveDown(); onClose(); }}
        disabled={!canMoveDown}
      >
        <IconChevronDown size={14} />
        <span>הזז למטה</span>
      </button>

      <div className="clcm-divider" />

      <button className="clcm-item" onClick={() => { onPinToggle(); onClose(); }}>
        {pinned ? <IconPinOff size={14} /> : <IconPin size={14} />}
        <span>{pinned ? 'בטל הקפאה' : 'הקפא עמודה'}</span>
      </button>

      {!isDeviation && (
        <button className="clcm-item" onClick={() => { onFilter(); onClose(); }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
          </svg>
          <span>סנן</span>
        </button>
      )}

      <div className="clcm-divider" />

      <button className="clcm-item" onClick={() => { onSortAsc(); onClose(); }}>
        <IconSortAsc size={14} />
        <span>מיון עולה</span>
      </button>

      <button className="clcm-item" onClick={() => { onSortDesc(); onClose(); }}>
        <IconSortDesc size={14} />
        <span>מיון יורד</span>
      </button>

      <button
        className="clcm-item"
        onClick={() => { onCancelSort(); onClose(); }}
        disabled={!sortDir}
      >
        <IconSortNone size={14} />
        <span>בטל מיון</span>
      </button>
    </div>,
    document.body,
  );
}
