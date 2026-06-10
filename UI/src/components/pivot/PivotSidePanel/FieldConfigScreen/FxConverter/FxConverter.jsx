import React from 'react';
import { useFxConverterLogic } from './FxConverter.logic.jsx';
import './FxConverter.css';

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/**
 * FX conversion config for one field. Numeric fields only — the parent
 * decides whether to render this section.
 *
 * Props:
 *   fx       — null or { currency, direction, month, year }
 *   onChange — replace fx (null to remove)
 */
export default function FxConverter({ fx, onChange }) {
  const L = useFxConverterLogic({ fx, onChange });

  return (
    <section className="fx-converter">
      <label className="fx-converter-toggle">
        <input
          type="checkbox"
          checked={L.enabled}
          onChange={(e) => L.setEnabled(e.target.checked)}
        />
        <span>הפעל המרת מטבע</span>
      </label>

      {L.enabled && (
        <div className="fx-converter-fields">
          <div className="fx-converter-field">
            <label className="fx-converter-label">מטבע</label>
            <input
              type="text"
              className="fx-converter-input"
              value={fx.currency || ''}
              onChange={(e) => L.update({ currency: e.target.value.toUpperCase() })}
              placeholder="USD"
              dir="ltr"
            />
          </div>

          <div className="fx-converter-field">
            <label className="fx-converter-label">כיוון</label>
            <select
              className="fx-converter-select"
              value={fx.direction || 'toIls'}
              onChange={(e) => L.update({ direction: e.target.value })}
            >
              <option value="toIls">המר ל-ILS (כפול בשער)</option>
              <option value="fromIls">המר מ-ILS (חלק בשער)</option>
            </select>
          </div>

          <div className="fx-converter-row">
            <div className="fx-converter-field">
              <label className="fx-converter-label">חודש</label>
              <select
                className="fx-converter-select"
                value={fx.month || 1}
                onChange={(e) => L.update({ month: parseInt(e.target.value, 10) })}
              >
                {MONTHS.map((m) => (
                  <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                ))}
              </select>
            </div>

            <div className="fx-converter-field">
              <label className="fx-converter-label">שנה</label>
              <input
                type="text"
                inputMode="numeric"
                className="fx-converter-input"
                value={fx.year || ''}
                onChange={(e) => L.update({ year: parseInt(e.target.value, 10) || 0 })}
                dir="ltr"
              />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
