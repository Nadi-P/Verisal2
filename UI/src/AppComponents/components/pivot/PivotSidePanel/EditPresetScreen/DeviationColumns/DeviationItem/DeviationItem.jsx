import React from 'react';
import { IconTrash } from '../../../../../icons.jsx';
import { useDeviationItemLogic } from './DeviationItem.logic.jsx';
import './DeviationItem.css';

/**
 * One compact deviation-pair row.
 *
 * Props:
 *   deviation     — { id, sourceA, sourceB, name, showDiff, showPercent }
 *   numericFields — list of value field names eligible for source picks
 *   onChange(d)   — replace this deviation
 *   onDelete(id)
 */
export default function DeviationItem({ deviation, numericFields, onChange, onDelete }) {
  const L = useDeviationItemLogic({ deviation, onChange, onDelete });

  // Build the dropdown options. If the deviation references a field that's
  // no longer in numericFields, include it as a (broken) option so the user
  // can see what's wrong.
  const optionsFor = (current) => {
    const seen = new Set(numericFields);
    const out = [...numericFields];
    if (current && !seen.has(current)) out.unshift(current);
    return out;
  };

  return (
    <div className="deviation-item">
      <div className="deviation-item-row">
        <select
          className="deviation-item-select"
          value={deviation.sourceA || ''}
          onChange={(e) => L.update({ sourceA: e.target.value || null })}
        >
          <option value="">—</option>
          {optionsFor(deviation.sourceA).map((f) => (
            <option key={`a-${f}`} value={f}>{f}</option>
          ))}
        </select>

        <button
          type="button"
          className="deviation-item-swap"
          onClick={L.swap}
          title="החלף מיקומים"
          aria-label="החלף"
        >
          ⇄
        </button>

        <select
          className="deviation-item-select"
          value={deviation.sourceB || ''}
          onChange={(e) => L.update({ sourceB: e.target.value || null })}
        >
          <option value="">—</option>
          {optionsFor(deviation.sourceB).map((f) => (
            <option key={`b-${f}`} value={f}>{f}</option>
          ))}
        </select>

        <button
          type="button"
          className="deviation-item-delete"
          onClick={L.remove}
          title="מחק"
          aria-label="מחק"
        >
          <IconTrash size={12} />
        </button>
      </div>

      <div className="deviation-item-row">
        <input
          type="text"
          className="deviation-item-name"
          placeholder="שם"
          value={deviation.name || ''}
          onChange={(e) => L.update({ name: e.target.value })}
        />

        <label className="deviation-item-check">
          <input
            type="checkbox"
            checked={!!deviation.showDiff}
            onChange={(e) => L.update({ showDiff: e.target.checked })}
          />
          <span>הפרש</span>
        </label>

        <label className="deviation-item-check">
          <input
            type="checkbox"
            checked={!!deviation.showPercent}
            onChange={(e) => L.update({ showPercent: e.target.checked })}
          />
          <span>%</span>
        </label>
      </div>
    </div>
  );
}
