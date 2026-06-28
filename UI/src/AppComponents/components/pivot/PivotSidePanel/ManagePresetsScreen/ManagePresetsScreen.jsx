import React, { useLayoutEffect, useRef, useState } from 'react';
import {
  IconSearch, IconReset, IconTrash, IconTag, IconBack,
} from '../../../icons.jsx';
import PresetListItem from './PresetListItem/PresetListItem.jsx';
import { useManagePresetsScreenLogic } from './ManagePresetsScreen.logic.jsx';
import './ManagePresetsScreen.css';

/**
 * Screen 1 — Manage saved presets.
 *
 * Props:
 *   savedPresets        — { name: preset }
 *   appliedName         — string | null
 *   defaultName         — string | null  (which saved preset IS the default)
 *   onBack              — return to previous screen
 *   onApply(name)       — request apply (parent shows confirmation)
 *   onDelete(name)
 *   onSetAsDefault(name)
 */
export default function ManagePresetsScreen({
  savedPresets,
  appliedName,
  defaultName,
  onBack,
  onApply,
  onDelete,
  onSetAsDefault,
  onRename,    // (oldName) => parent opens the rename dialog
}) {
  const L = useManagePresetsScreenLogic({ savedPresets });

  return (
    <div className="manage-presets-screen">
      {/* Header — back lives in the TopBar now, only the title here */}
      <div className="manage-presets-header">
        <span className="manage-presets-title">ניהול תבניות</span>
      </div>

      {/* Current state summary (parent already applied the fallback chain) */}
      <div className="manage-presets-summary">
        <div className="manage-presets-summary-row">
          <span className="manage-presets-summary-label">תבנית בשימוש:</span>
          <span className="manage-presets-summary-value manage-presets-summary-value-applied">
            {appliedName || 'ללא תבנית'}
          </span>
        </div>
        <div className="manage-presets-summary-row">
          <span className="manage-presets-summary-label">ברירת מחדל:</span>
          <span className="manage-presets-summary-value manage-presets-summary-value-default">
            {defaultName || 'לא נקבעה'}
          </span>
        </div>
      </div>

      {/* Bank-style container: search + list (matches FieldBank) */}
      <div className="manage-presets-bank">
        <div className="manage-presets-search">
          <IconSearch size={14} />
          <input
            type="text"
            placeholder="חפש תבנית..."
            value={L.query}
            onChange={(e) => L.setQuery(e.target.value)}
          />
        </div>

        <div className="manage-presets-list">
          {L.totalCount === 0 ? (
            <div className="manage-presets-empty">אין תבניות שמורות</div>
          ) : L.filteredNames.length === 0 ? (
            <div className="manage-presets-empty">לא נמצאו תוצאות</div>
          ) : (
            L.filteredNames.map((name) => (
              <PresetListItem
                key={name}
                name={name}
                isApplied={name === appliedName}
                isDefault={name === defaultName}
                onClick={() => L.setSelected(name)}
                onOpenMenu={(x, y, anchor) => L.openMenu(name, x, y, anchor)}
              />
            ))
          )}
        </div>
      </div>

      {/* Actions menu (right-click or dots) */}
      {L.menu && (() => {
        const isDefault = L.menu.name === defaultName;
        return (
          <PresetActionsMenu
            menu={L.menu}
            isDefault={isDefault}
            onApply={()        => { onApply?.(L.menu.name);        L.closeMenu(); }}
            onSetAsDefault={() => { onSetAsDefault?.(L.menu.name); L.closeMenu(); }}
            onRename={()       => { onRename?.(L.menu.name);       L.closeMenu(); }}
            onDelete={()       => { onDelete?.(L.menu.name);       L.closeMenu(); }}
          />
        );
      })()}
    </div>
  );
}

/**
 * Floating actions menu — measures itself in a useLayoutEffect so the
 * bottom-left corner lands EXACTLY at the click point when the anchor is
 * 'bottom'. The previous CSS-only `transform: translateY(-100%)` approach
 * was unreliable on portaled fixed elements + variable item counts; this
 * measures the rendered height and uses real pixel offsets.
 */
function PresetActionsMenu({ menu, isDefault, onApply, onSetAsDefault, onRename, onDelete }) {
  const ref = useRef(null);
  const [top, setTop] = useState(menu.y);

  useLayoutEffect(() => {
    if (!ref.current) return;
    if (menu.anchor === 'bottom') {
      const h = ref.current.getBoundingClientRect().height;
      setTop(menu.y - h);
    } else {
      setTop(menu.y);
    }
  }, [menu.x, menu.y, menu.anchor]);

  return (
    <div
      ref={ref}
      className="manage-presets-menu"
      style={{ left: menu.x, top }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="manage-presets-menu-item" onClick={onApply}>
        <IconReset size={14} />
        <span>החל</span>
      </div>
      <div
        className={`manage-presets-menu-item ${isDefault ? 'is-disabled' : ''}`}
        onClick={isDefault ? undefined : onSetAsDefault}
        title={isDefault ? 'תבנית זו כבר ברירת המחדל' : undefined}
      >
        <IconBack size={14} />
        <span>קבע כברירת מחדל</span>
      </div>
      <div className="manage-presets-menu-item" onClick={onRename}>
        <IconTag size={14} />
        <span>שנה שם</span>
      </div>
      <div className="manage-presets-menu-divider" />
      <div
        className={`manage-presets-menu-item is-danger ${isDefault ? 'is-disabled' : ''}`}
        onClick={isDefault ? undefined : onDelete}
        title={isDefault ? 'לא ניתן למחוק את תבנית ברירת המחדל' : undefined}
      >
        <IconTrash size={14} />
        <span>מחק</span>
      </div>
    </div>
  );
}
