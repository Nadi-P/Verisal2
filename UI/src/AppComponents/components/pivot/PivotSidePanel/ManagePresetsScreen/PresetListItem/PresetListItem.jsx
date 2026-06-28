import React from 'react';
import { IconDots } from '../../../../icons.jsx';
import { usePresetListItemLogic } from './PresetListItem.logic.jsx';
import './PresetListItem.css';

/**
 * Single row in the Manage Presets list.
 *
 * Props:
 *   name              — preset name
 *   isApplied         — currently applied (accent highlight)
 *   isDefault         — currently the report's default (yellow-orange highlight)
 *   onClick           — single-click; selects the row (no apply)
 *   onOpenMenu(x, y)  — open the actions menu
 */
export default function PresetListItem({ name, isApplied, isDefault, onClick, onOpenMenu }) {
  const L = usePresetListItemLogic({ onOpenMenu });

  // Accent overrides default highlight (per requirements)
  const cls = [
    'preset-list-item',
    isApplied  ? 'is-applied'  : '',
    !isApplied && isDefault ? 'is-default' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cls}
      onClick={onClick}
      onContextMenu={L.handleContextMenu}
      onMouseEnter={L.handleMouseEnter}
      onMouseLeave={L.handleMouseLeave}
    >

      
      <span className="preset-list-item-name">{name}</span>

      

      {isDefault && (
        <span className="preset-list-item-badge" title="ברירת מחדל">ברירת מחדל</span>
      )}

      {/* {L.hovered && (
        <button
          type="button"
          className="preset-list-item-dots"
          onClick={L.handleDotsClick}
          title="פעולות"
          aria-label="פעולות"
        >
          <IconDots size={14} />
        </button>
      )} */}
      
    </div>
  );
}
