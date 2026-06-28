import React from 'react';

/**
 * Field-config section wrapper.
 *
 * Header layout (RTL, reading right-to-left):
 *   [title] ............... [headActions] [Activate / Deactivate]
 *
 * The activate/deactivate button lives at the visual far-left (end of
 * the row in RTL). `headActions` slot — when active — sits just before
 * it and is meant for icon-only secondary controls (toggle direction,
 * add rate, etc.). Both are wrapped in a single `.fc-section-actions`
 * div so they stay grouped opposite the title.
 *
 * Props:
 *   title       — section header text
 *   active      — boolean
 *   onToggle    — fired when the user clicks activate/deactivate
 *   headActions — optional ReactNode rendered next to the toggle (only
 *                 when `active`)
 *   children    — section body, rendered only when active
 */
export default function SectionShell({
  title, active, onToggle, headActions, children,
}) {
  return (
    <div className="field-config-section">
      <div className="fc-section-head">
        <span className="field-config-section-title">{title}</span>
        <div className="fc-section-actions">
          {active && headActions}
          <button
            type="button"
            className={`fc-section-toggle ${active ? 'is-active' : ''}`}
            onClick={onToggle}
          >
            {active ? 'השבת' : 'הפעל'}
          </button>
        </div>
      </div>
      {active && <div className="fc-section-body">{children}</div>}
    </div>
  );
}
