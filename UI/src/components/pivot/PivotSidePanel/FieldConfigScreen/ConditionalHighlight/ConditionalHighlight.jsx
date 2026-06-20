import React from 'react';
import {
  ALL_OPERATORS, opTypeAndArgs, deriveActiveOp, buildPayload,
} from './ConditionalHighlight.logic.jsx';

/**
 * Merged threshold + statistical highlighting.
 *
 *   ┌───────────────────────────────────────────┐
 *   │  [pick operator ▾]                         │
 *   │  args (0, 1, or 2 depending on operator)   │
 *   └───────────────────────────────────────────┘
 *
 * Threshold-style ops (>, <, ==, >=, <=, between) write to
 * `config.thresholds[field]`.  Stat-style ops (top10, bottom10pct,
 * aboveAvg, ...) write to `config.statHighlights[field]`. Only one is
 * active per field at a time; switching operators clears the other.
 *
 * The OUTER toggle (activate/deactivate) is owned by the parent via
 * `SectionShell` — this component just renders the operator + inputs.
 *
 * Props:
 *   threshold       — current threshold cfg or null
 *   statHighlight   — current stat cfg or null
 *   onChangeThreshold(next | null)
 *   onChangeStat(next | null)
 */
export default function ConditionalHighlight({
  threshold, statHighlight, onChangeThreshold, onChangeStat,
}) {
  const activeOp = deriveActiveOp(threshold, statHighlight);
  const { type, args } = opTypeAndArgs(activeOp);

  const updateOperator = (nextOp) => {
    const next = buildPayload(nextOp, threshold, statHighlight);
    const nextType = opTypeAndArgs(nextOp).type;
    if (nextType === 'threshold') {
      onChangeStat(null);
      onChangeThreshold(next);
    } else {
      onChangeThreshold(null);
      onChangeStat(next);
    }
  };

  const updateValue = (which, raw) => {
    if (type !== 'threshold') return;
    const num = parseFloat(raw);
    const safe = Number.isFinite(num) ? num : 0;
    onChangeThreshold({
      ...(threshold || { operator: activeOp }),
      [which]: safe,
    });
  };

  return (
    <div className="fc-cond-highlight">
      <div className="fc-field">
        <label className="fc-field-label">תנאי</label>
        <select
          className="fc-input"
          value={activeOp}
          onChange={(e) => updateOperator(e.target.value)}
        >
          {ALL_OPERATORS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {args >= 1 && (
        <div className="fc-field">
          <label className="fc-field-label">{args === 2 ? 'ערך 1' : 'ערך'}</label>
          <input
            type="text" inputMode="decimal" dir="ltr"
            className="fc-input"
            value={threshold?.value1 ?? ''}
            onChange={(e) => updateValue('value1', e.target.value)}
          />
        </div>
      )}
      {args === 2 && (
        <div className="fc-field">
          <label className="fc-field-label">ערך 2</label>
          <input
            type="text" inputMode="decimal" dir="ltr"
            className="fc-input"
            value={threshold?.value2 ?? ''}
            onChange={(e) => updateValue('value2', e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
