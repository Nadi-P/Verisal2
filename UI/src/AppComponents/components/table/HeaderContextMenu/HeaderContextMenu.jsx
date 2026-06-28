import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  IconPin, IconPinOff,
  IconSortAsc, IconSortDesc, IconSortNone,
} from '../../icons.jsx';
import './HeaderContextMenu.css';

/**
 * Right-click context menu opened from a table header cell.
 *
 * Items:
 *   - Pin / Unpin            (label flips with current state)
 *   - Filter                 (opens the FilterMenu — parent owns this)
 *   - Sort ascending
 *   - Sort descending
 *   - Cancel sorting         (disabled when column is not currently sorted)
 *
 * The menu portals to body so it isn't clipped by the table's overflow.
 * It closes on any click outside or Escape.
 */
export default function HeaderContextMenu({
  position,        // { top, left }
  pinned,
  sortDir,         // 'asc' | 'desc' | null
  onPinToggle,
  onFilter,
  onSortAsc,
  onSortDesc,
  onCancelSort,
  onClose,
}) {
  useEffect(() => {
    const onDown = (e) => {
      if (e.target.closest && e.target.closest('.header-context-menu')) return;
      onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      className="header-context-menu"
      style={{ top: position.top, left: position.left }}
    >
      <button className="hcm-item" onClick={() => { onPinToggle(); onClose(); }}>
        {pinned ? <IconPinOff size={14} /> : <IconPin size={14} />}
        <span>{pinned ? 'בטל הקפאה' : 'הקפא עמודה'}</span>
      </button>

      <button className="hcm-item" onClick={() => { onFilter(); onClose(); }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        <span>סנן</span>
      </button>

      <div className="hcm-divider" />

      <button className="hcm-item" onClick={() => { onSortAsc(); onClose(); }}>
        <IconSortAsc size={14} />
        <span>מיון עולה</span>
      </button>

      <button className="hcm-item" onClick={() => { onSortDesc(); onClose(); }}>
        <IconSortDesc size={14} />
        <span>מיון יורד</span>
      </button>

      <button
        className="hcm-item"
        onClick={() => { onCancelSort(); onClose(); }}
        disabled={!sortDir}
      >
        <IconSortNone size={14} />
        <span>בטל מיון</span>
      </button>
    </div>,
    document.body
  );
}
