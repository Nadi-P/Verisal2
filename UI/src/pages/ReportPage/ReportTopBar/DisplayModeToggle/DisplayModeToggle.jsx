import React from 'react';
import { useDisplayModeToggleLogic, MODES } from './DisplayModeToggle.logic.jsx';
import './DisplayModeToggle.css';

/**
 * Two-option segmented control with an animated pill that slides between the
 * choices. The pill's position is driven entirely by CSS via data-mode on the
 * container — no JS measurement.
 *
 * Props:
 *   value     — 'pivot' | 'table'
 *   onChange  — (next) => void
 */
export default function DisplayModeToggle({ value, onChange }) {
  const L = useDisplayModeToggleLogic({ value, onChange });

  return (
    <div className="display-mode-toggle" data-mode={value}>
      <span className="display-mode-toggle-pill" />
      {MODES.map((m) => (
        <button
          key={m.value}
          type="button"
          className={`display-mode-toggle-option ${m.value === value ? 'is-active' : ''}`}
          onClick={() => L.select(m.value)}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
