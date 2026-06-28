import React from 'react';
import { useConfirmDialogLogic } from './ConfirmDialog.logic.jsx';
import './ConfirmDialog.css';

/**
 * Centered modal blocking the content area. The sidebar nav (TopBar) remains
 * clickable — the orchestrator dismisses the dialog if the user clicks a
 * TopBar control while it's open.
 *
 * Props:
 *   title           — short header text
 *   message         — body text (string or node)
 *   confirmLabel    — defaults to 'אישור'
 *   cancelLabel     — defaults to 'ביטול'
 *   variant         — 'default' | 'danger' (red confirm button)
 *   onConfirm, onCancel
 */
export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'אישור',
  cancelLabel  = 'ביטול',
  variant      = 'default',
  onConfirm,
  onCancel,
}) {
  const L = useConfirmDialogLogic({ onCancel });

  return (
    <div className="confirm-dialog-overlay" onClick={L.handleOverlayClick}>
      <div className="confirm-dialog" role="dialog" aria-modal="true">
        {title && <div className="confirm-dialog-title">{title}</div>}
        <div className="confirm-dialog-message">{message}</div>
        <div className="confirm-dialog-actions">
          <button
            type="button"
            className="confirm-dialog-btn confirm-dialog-btn-ghost"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={`confirm-dialog-btn ${variant === 'danger' ? 'confirm-dialog-btn-danger' : 'confirm-dialog-btn-primary'}`}
            onClick={onConfirm}
            autoFocus
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
