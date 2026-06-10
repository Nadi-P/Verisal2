import React from 'react';
import { useConfigurationPageLogic } from './ConfigurationPage.logic.jsx';
import { IconPlus, IconTrash } from '../../components/icons.jsx';
import './ConfigurationPage.css';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

function FxCard({ id, fx, onRemove, onUpdate }) {
  return (
    <div className="config-card">
      <div className="config-card-header">
        <div className="config-card-fields config-card-fields-fx">
          <div className="config-field">
            <label className="config-field-label">מטבע</label>
            <input
              className="config-input"
              type="text"
              value={fx.currency}
              onChange={(e) => onUpdate(id, 'currency', e.target.value)}
              placeholder="USD"
              dir="ltr"
            />
          </div>
          <div className="config-field">
            <label className="config-field-label">חודש</label>
            <select
              className="config-select"
              value={fx.month}
              onChange={(e) => onUpdate(id, 'month', e.target.value)}
            >
              {MONTHS.map((m) => (
                <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
              ))}
            </select>
          </div>
          <div className="config-field">
            <label className="config-field-label">שנה</label>
            <input
              className="config-input config-input-num"
              type="text"
              inputMode="numeric"
              value={fx.year}
              onChange={(e) => onUpdate(id, 'year', e.target.value)}
              dir="ltr"
            />
          </div>
          <div className="config-field">
            <label className="config-field-label">שער ל-ILS</label>
            <input
              className="config-input config-input-num"
              type="text"
              inputMode="decimal"
              value={fx.rate}
              onChange={(e) => onUpdate(id, 'rate', e.target.value)}
              dir="ltr"
            />
          </div>
        </div>
        <button className="config-btn-icon config-btn-danger" onClick={() => onRemove(id)} title="מחק שער">
          <IconTrash />
        </button>
      </div>
    </div>
  );
}

export default function ConfigurationPage() {
  const {
    loading,
    toast,
    savedFxCount,

    draftFx,
    fxDirty,
    savingFx,
    addFxRate,
    removeFxRate,
    updateFxRate,
    saveFx,
    discardFx,
  } = useConfigurationPageLogic();

  if (loading) {
    return (
      <div className="config-page">
        <div className="config-loading">טוען הגדרות...</div>
      </div>
    );
  }

  const fxEntries = Object.entries(draftFx);

  return (
    <div className="config-page">
      {/* Header */}
      <div className="config-header">
        <h1 className="config-title">הגדרות</h1>
      </div>

      {/* Content */}
      <div className="config-content">
        <div className="config-section">
          <div className="config-section-header">
            <div className="config-section-info">
              <h2 className="config-section-title">
                שערי מט״ח
                <span className="config-tab-count" style={{ marginInlineStart: 8 }}>{savedFxCount}</span>
              </h2>
              <p className="config-section-desc">
                הגדר שערי המרה למטבעות זרים לפי חודש. ניתן לשייך המרה לעמודות מספריות בדוחות.
              </p>
            </div>
            <div className="config-section-header-actions">
              <button className="config-btn config-btn-accent" onClick={addFxRate}>
                <IconPlus /> שער חדש
              </button>
            </div>
          </div>

          {/* FX global save/cancel */}
          <div className="fx-global-actions">
            <button
              className="config-btn config-btn-ghost config-btn-xs"
              onClick={discardFx}
              disabled={!fxDirty}
            >
              בטל שינויים
            </button>
            <button
              className="config-btn config-btn-primary config-btn-xs"
              onClick={saveFx}
              disabled={!fxDirty || savingFx}
            >
              {savingFx ? 'שומר...' : 'שמור'}
            </button>
          </div>

          {fxEntries.length === 0 ? (
            <div className="config-empty">אין שערי מט״ח מוגדרים</div>
          ) : (
            <div className="config-card-list">
              {fxEntries.map(([id, fx]) => (
                <FxCard
                  key={id}
                  id={id}
                  fx={fx}
                  onRemove={removeFxRate}
                  onUpdate={updateFxRate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`config-toast config-toast-${toast.type}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
