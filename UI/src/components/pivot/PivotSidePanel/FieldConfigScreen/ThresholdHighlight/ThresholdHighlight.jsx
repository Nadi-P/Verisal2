import React from 'react';
import { useThresholdHighlightLogic, OPERATORS } from './ThresholdHighlight.logic.jsx';
import './ThresholdHighlight.css';

/**
 * Highlights cells green when they match the operator/value(s), red when they don't.
 */
export default function ThresholdHighlight({ threshold, onChange }) {
  const L = useThresholdHighlightLogic({ threshold, onChange });
  const isBetween = threshold?.operator === 'between';

  return (
    <section className="threshold-highlight">
      <label className="threshold-highlight-toggle">
        <input
          type="checkbox"
          checked={L.enabled}
          onChange={(e) => L.setEnabled(e.target.checked)}
        />
        <span>הפעל סף הדגשה</span>
      </label>

      {L.enabled && (
        <div className="threshold-highlight-fields">
          <div className="threshold-highlight-row">
            <div className="threshold-highlight-field">
              <label className="threshold-highlight-label">תנאי</label>
              <select
                className="threshold-highlight-select"
                value={threshold.operator}
                onChange={(e) => L.update({ operator: e.target.value })}
              >
                {OPERATORS.map((op) => (
                  <option key={op.value} value={op.value}>{op.label}</option>
                ))}
              </select>
            </div>

            <div className="threshold-highlight-field">
              <label className="threshold-highlight-label">{isBetween ? 'ערך 1' : 'ערך'}</label>
              <input
                type="text"
                inputMode="decimal"
                className="threshold-highlight-input"
                value={threshold.value1 ?? ''}
                onChange={(e) => L.update({ value1: parseFloat(e.target.value) || 0 })}
                dir="ltr"
              />
            </div>

            {isBetween && (
              <div className="threshold-highlight-field">
                <label className="threshold-highlight-label">ערך 2</label>
                <input
                  type="text"
                  inputMode="decimal"
                  className="threshold-highlight-input"
                  value={threshold.value2 ?? ''}
                  onChange={(e) => L.update({ value2: parseFloat(e.target.value) || 0 })}
                  dir="ltr"
                />
              </div>
            )}
          </div>

          <div className="threshold-highlight-legend">
            <span className="threshold-highlight-swatch is-pass">ירוק = עומד בתנאי</span>
            <span className="threshold-highlight-swatch is-fail">אדום = לא עומד</span>
          </div>
        </div>
      )}
    </section>
  );
}
