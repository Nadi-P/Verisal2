import React from 'react';
import { useSaveDialogLogic } from './SaveDialog.logic.jsx';
import { IconBack } from '../../../icons.jsx';
import './SaveDialog.css';

/**
 * Modal that lets the user choose between overriding the current preset
 * or saving the current configuration under a new name.
 *
 * Props:
 *   existingNames   — list of already-saved preset names (for uniqueness check)
 *   onCancel        — dismiss
 *   onPickOverride  — user chose "override current" (parent shows ConfirmDialog)
 *   onSubmitNew     — user entered & confirmed a new name
 */
export default function SaveDialog({
  existingNames,
  overrideDisabled = false,
  overrideTargetName = null,
  onCancel,
  onPickOverride,
  onSubmitNew,
}) {
  const L = useSaveDialogLogic({ existingNames, onCancel, onPickOverride, onSubmitNew });

  return (
    <div className="save-dialog-overlay" onClick={L.handleOverlayClick}>
      <div className="save-dialog" role="dialog" aria-modal="true">
        {L.mode === 'choose' && (
          <>
            <div className="save-dialog-title">שמור תבנית</div>
            <div className="save-dialog-message">בחר כיצד לשמור את התצורה הנוכחית.</div>
            <div className="save-dialog-choices">
              <button
                type="button"
                className="save-dialog-choice"
                onClick={L.pickOverride}
                disabled={overrideDisabled}
              >
                <div className="save-dialog-choice-title">
                  דרוס תבנית{overrideTargetName ? `: "${overrideTargetName}"` : ' נוכחית'}
                </div>
                <div className="save-dialog-choice-desc">
                  {overrideDisabled
                    ? 'אין תבנית בשימוש להחלפה.'
                    : 'החלף את התבנית שבשימוש בתצורה הנוכחית.'}
                </div>
              </button>
              <button
                type="button"
                className="save-dialog-choice"
                onClick={L.pickNew}
              >
                <div className="save-dialog-choice-title">שמור כחדשה</div>
                <div className="save-dialog-choice-desc">צור תבנית חדשה עם שם משלך.</div>
              </button>
            </div>
            <div className="save-dialog-actions">
              <button
                type="button"
                className="save-dialog-btn save-dialog-btn-ghost"
                onClick={onCancel}
              >
                ביטול
              </button>
            </div>
          </>
        )}

        {L.mode === 'naming' && (
          <>
            <div className="save-dialog-title save-dialog-title-with-back">
              <button
                type="button"
                className="save-dialog-back"
                onClick={L.backToChoose}
                aria-label="חזור"
                title="חזור"
              >
                <IconBack size={14} />
              </button>
              <span>שמור כתבנית חדשה</span>
            </div>
            <label className="save-dialog-field">
              <span className="save-dialog-field-label">שם התבנית</span>
              <input
                autoFocus
                type="text"
                className={`save-dialog-input ${L.nameError ? 'has-error' : ''}`}
                value={L.name}
                onChange={(e) => L.setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && L.canSubmitNew) L.submitNew(); }}
                placeholder="לדוגמה: ניתוח חודשי"
              />
              {L.nameError && <span className="save-dialog-error">{L.nameError}</span>}
            </label>
            <div className="save-dialog-actions">
              <button
                type="button"
                className="save-dialog-btn save-dialog-btn-ghost"
                onClick={onCancel}
              >
                ביטול
              </button>
              <button
                type="button"
                className="save-dialog-btn save-dialog-btn-primary"
                onClick={L.submitNew}
                disabled={!L.canSubmitNew}
              >
                שמור
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
