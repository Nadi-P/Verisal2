import React from 'react';
import { useContextMenuLogic } from './ContextMenu.logic.jsx';
import { AGG_LABELS } from '../DropZone/DropZone.logic.jsx';
import {
  IconChevronDown, IconBack, IconConfig, IconTrash,
} from '../../../../icons.jsx';
import './ContextMenu.css';

const AGG_OPTIONS = Object.keys(AGG_LABELS);

/**
 * Right-click menu for items inside a drop zone.
 *
 * Props:
 *   x, y          — anchor (clientX/clientY)
 *   zone          — 'rows' | 'values'
 *   item          — the zone item (string for rows, {field, aggregation} for values)
 *   onClose       — dismiss
 *   onMoveUp / onMoveDown / onMoveStart / onMoveEnd
 *   onTransferRows / onTransferValues  (the other zone)
 *   onOpenFieldConfig — double-click equivalent, opens FieldConfigScreen
 *   onSetAggregation(agg) — values only
 *   onRemove
 */
export default function ContextMenu({
  x, y, zone, item,
  onClose,
  onMoveUp, onMoveDown, onMoveStart, onMoveEnd,
  onTransferRows, onTransferValues,
  onOpenFieldConfig,
  onSetAggregation,
  onRemove,
}) {
  useContextMenuLogic({ onClose });

  const isValue = zone === 'values';
  const isDev = typeof item === 'object' && item !== null && item.deviation === true;
  const style = { left: x, top: y };

  return (
    <div
      className="context-menu"
      style={style}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => e.stopPropagation()}
    >
      <MenuItem onClick={onMoveUp}     icon={<IconChevronDown size={14} className="cm-flip" />}>הזז למעלה</MenuItem>
      <MenuItem onClick={onMoveDown}   icon={<IconChevronDown size={14} />}>הזז למטה</MenuItem>
      <MenuItem onClick={onMoveStart}  icon={<IconChevronDown size={14} className="cm-flip" />}>הזז להתחלה</MenuItem>
      <MenuItem onClick={onMoveEnd}    icon={<IconChevronDown size={14} />}>הזז לסוף</MenuItem>
      <Divider />
      {/* Deviation items live only in Values — no transfer options for them. */}
      {!isDev && zone !== 'rows'   && <MenuItem onClick={onTransferRows}   icon={<IconBack size={14} />}>העבר לשורות</MenuItem>}
      {!isDev && zone !== 'values' && <MenuItem onClick={onTransferValues} icon={<IconBack size={14} />}>העבר לערכים</MenuItem>}
      <Divider />
      <MenuItem onClick={onOpenFieldConfig} icon={<IconConfig size={14} />}>הגדרות שדה</MenuItem>
      {isValue && !isDev && (
        <>
          <Divider />
          <div className="context-menu-section">סוג צבירה</div>
          {AGG_OPTIONS.map((agg) => (
            <MenuItem
              key={agg}
              onClick={() => onSetAggregation?.(agg)}
              isActive={item?.aggregation === agg}
            >
              {AGG_LABELS[agg]}
            </MenuItem>
          ))}
        </>
      )}
      <Divider />
      <MenuItem onClick={onRemove} icon={<IconTrash size={14} />} isDanger>הסר</MenuItem>
    </div>
  );
}

function MenuItem({ children, onClick, isDanger, isActive, icon }) {
  const cls = [
    'context-menu-item',
    isDanger ? 'is-danger' : '',
    isActive ? 'is-active' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls} onClick={onClick}>
      {icon && <span className="context-menu-icon" aria-hidden="true">{icon}</span>}
      <span>{children}</span>
    </div>
  );
}

function Divider() {
  return <div className="context-menu-divider" />;
}
