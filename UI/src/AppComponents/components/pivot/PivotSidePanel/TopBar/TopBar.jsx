import React from 'react';
import { IconReset, IconBars, IconTag, IconX, IconBack, IconFootsteps } from '../../../icons.jsx';
import { useTopBarLogic } from './TopBar.logic.jsx';
import './TopBar.css';

/**
 * Side-panel top bar — icon-only buttons.
 *
 * Layout (in DOM order; in RTL this reads from the right):
 *   [ Back (if showBack) ] [ X ]   ...spacer...   [ Save ] [ Manage ] [ Reset ]
 *
 * Props:
 *   onClose, onManage, onSave, onReset, onBack
 *   showBack       — render the back arrow (used on non-Edit screens)
 *   resetDisabled  — true when current config already equals the default
 *   saveDisabled   — true when there's nothing to save (no changes)
 */
export default function TopBar({
  onClose,
  onManage,
  onSave,
  onReset,
  onBack,
  onReopenLastTrace,
  hasLastTrace  = false,
  showBack      = false,
  resetDisabled = false,
  saveDisabled  = false,
}) {
  const L = useTopBarLogic({ onReset, onManage, onSave, onClose, onBack });

  return (
    <div className="pivot-topbar">
      <button
        type="button"
        className="pivot-topbar-btn"
        onClick={L.handleClose}
        title="סגור"
        aria-label="סגור"
      >
        <IconX size={16} />
      </button>

      {showBack && (
        <button
          type="button"
          className="pivot-topbar-btn"
          onClick={L.handleBack}
          title="חזור"
          aria-label="חזור"
        >
          <IconBack size={16} />
        </button>
      )}

      <div className="pivot-topbar-spacer" />

      <button
        type="button"
        className="pivot-topbar-btn"
        onClick={onReopenLastTrace}
        disabled={!hasLastTrace}
        title="פתיחה מחדש של המעקב האחרון"
        aria-label="פתיחה מחדש של המעקב האחרון"
      >
        <IconFootsteps size={16} />
      </button>

      <button
        type="button"
        className="pivot-topbar-btn"
        onClick={L.handleSave}
        disabled={saveDisabled}
        title="שמור תבנית"
        aria-label="שמור תבנית"
      >
        <IconTag size={16} />
      </button>

      <button
        type="button"
        className="pivot-topbar-btn"
        onClick={L.handleManage}
        title="ניהול תבניות"
        aria-label="ניהול תבניות"
      >
        <IconBars size={16} />
      </button>

      <button
        type="button"
        className="pivot-topbar-btn"
        onClick={L.handleReset}
        disabled={resetDisabled}
        title="איפוס לברירת מחדל"
        aria-label="איפוס לברירת מחדל"
      >
        <IconReset size={16} />
      </button>
    </div>
  );
}
