import React, { useState, useEffect, useMemo } from 'react';
import { IconTag } from '../../../icons.jsx';
import './RenameDialog.css';

/**
 * Modal for renaming a saved preset. Pre-fills the input with the current
 * name, validates uniqueness against the other existing names, and submits
 * the new name to the parent.
 *
 * Props:
 *   originalName   — current name (used as initial input + skipped in
 *                    uniqueness check)
 *   existingNames  — all saved preset names (for uniqueness check)
 *   onCancel       — dismiss without changing anything
 *   onSubmit(name) — confirmed; the parent persists + closes
 */
export default function RenameDialog({
  originalName,
  existingNames = [],
  onCancel,
  onSubmit,
}) {
  const [name, setName] = useState(originalName || '');

  // Re-initialize whenever a new originalName comes in.
  useEffect(() => { setName(originalName || ''); }, [originalName]);

  const others = useMemo(
    () => new Set(existingNames.filter((n) => n !== originalName)),
    [existingNames, originalName]
  );

  const trimmed = name.trim();
  const error =
    trimmed.length === 0    ? 'יש להזין שם'
    : trimmed === originalName ? null               /* unchanged — allow as no-op */
    : others.has(trimmed)   ? 'קיימת תבנית בשם זה'
    : null;
  const canSubmit = !error && trimmed.length > 0;

  return (
    <div className="rename-dialog-overlay" onClick={onCancel}>
      <div
        className="rename-dialog"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rename-dialog-title">
          <IconTag size={14} />
          <span>שנה שם תבנית</span>
        </div>

        <label className="rename-dialog-field">
          <span className="rename-dialog-field-label">שם חדש</span>
          <input
            autoFocus
            type="text"
            className={`rename-dialog-input ${error ? 'has-error' : ''}`}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter'  && canSubmit) onSubmit(trimmed);
              if (e.key === 'Escape') onCancel();
            }}
          />
          {error && <span className="rename-dialog-error">{error}</span>}
        </label>

        <div className="rename-dialog-actions">
          <button
            type="button"
            className="rename-dialog-btn rename-dialog-btn-ghost"
            onClick={onCancel}
          >
            ביטול
          </button>
          <button
            type="button"
            className="rename-dialog-btn rename-dialog-btn-primary"
            onClick={() => onSubmit(trimmed)}
            disabled={!canSubmit}
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
}
