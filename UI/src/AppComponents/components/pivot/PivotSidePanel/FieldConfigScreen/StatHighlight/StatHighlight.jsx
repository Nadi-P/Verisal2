import React from 'react';
import { useStatHighlightLogic, STAT_OPTIONS } from './StatHighlight.logic.jsx';
import './StatHighlight.css';

/**
 * Conditional formatting based on rank/average (Excel-style).
 * Matching cells get a green highlight; non-matching cells stay neutral.
 */
export default function StatHighlight({ statHighlight, onChange }) {
  const L = useStatHighlightLogic({ statHighlight, onChange });

  return (
    <section className="stat-highlight">
      <label className="stat-highlight-toggle">
        <input
          type="checkbox"
          checked={L.enabled}
          onChange={(e) => L.setEnabled(e.target.checked)}
        />
        <span>הפעל הדגשה סטטיסטית</span>
      </label>

      {L.enabled && (
        <div className="stat-highlight-fields">
          <div className="stat-highlight-field">
            <label className="stat-highlight-label">סוג</label>
            <select
              className="stat-highlight-select"
              value={statHighlight.kind}
              onChange={(e) => L.setKind(e.target.value)}
            >
              {STAT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div className="stat-highlight-legend">
            <span className="stat-highlight-swatch">ירוק = עומד בקריטריון</span>
          </div>
        </div>
      )}
    </section>
  );
}
