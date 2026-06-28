import React from 'react';
import { useUploadManager } from '../../../../contexts/UploadManagerContext.jsx';
import { useTrace, resolvePanelView } from '../../../../contexts/TraceContext.jsx';
import './CalculationInfoScreen.css';

/**
 * Side-panel screen that shows the lineage of the most recently
 * trace-triggered cell:
 *
 *   • Meta block — Report / Column / Row / Value, one per line.
 *   • Formula    — column's symbolic expression. Display-only; uses the
 *                  same font stack as the rest of the app.
 *   • References — clickable list of upstream cells. Each row shows the
 *                  source report's display label + the source column's
 *                  display name + the cell value. Clicking navigates to
 *                  the source report and highlights that cell.
 */
export default function CalculationInfoScreen({ currentReportId, displayMode }) {
  const { payload } = useUploadManager();
  const { panelTarget, navigateToRef } = useTrace();

  const view = React.useMemo(
    () => resolvePanelView(payload, panelTarget),
    [payload, panelTarget],
  );

  if (!view) {
    return (
      <div className="field-config-screen">
        <div className="field-config-header">
          <span className="field-config-title">פירוט חישוב</span>
        </div>
        <div className="field-config-body">
          <div className="field-config-note">לחיצה ימנית כפולה על תא לצפייה בלינאז'.</div>
        </div>
      </div>
    );
  }

  const onRefClick = (refEntry) => {
    if (!refEntry || !refEntry.sourceReport) return;
    const { sourceReport, ref } = refEntry;
    navigateToRef(sourceReport.id, ref.c, ref.i, currentReportId);
  };

  // Clicking the 4-row meta block = navigate back to the source cell's
  // report (just like a reference row, but pointing at the cell itself).
  const onMetaBlockClick = () => {
    if (!view || !view.report) return;
    navigateToRef(view.report.id, view.columnIdx, view.rowIdx, currentReportId);
  };

  return (
    <div className="field-config-screen">
      <div className="field-config-header">
        <span className="field-config-title">
          פירוט חישוב:
          <span className="field-config-field-name">{view.columnName}</span>
        </span>
      </div>

      <div className="field-config-body calc-info-body">
        {/* Meta block — 4 separate rows, no combined fields. The whole
            container is a button that navigates the user back to the
            cell's source report (mirrors the ref-row click affordance). */}
        <div
          className="calc-info-section calc-info-meta-clickable"
          role="button"
          tabIndex={0}
          onClick={onMetaBlockClick}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onMetaBlockClick();
            }
          }}
          title={`מעבר ל-${view.report.display_label || view.report.id}`}
        >
          <div className="calc-info-row">
            <span className="calc-info-row-label">דוח</span>
            <span className="calc-info-row-value">{view.report.display_label || view.report.id}</span>
          </div>
          <div className="calc-info-row">
            <span className="calc-info-row-label">עמודה</span>
            <span className="calc-info-row-value">
              {view.columnName}
              <span className="calc-info-row-idx">({view.columnIdx + 1})</span>
            </span>
          </div>
          <div className="calc-info-row">
            <span className="calc-info-row-label">שורה</span>
            <span className="calc-info-row-value">{view.rowIdx + 1}</span>
          </div>
          <div className="calc-info-row">
            <span className="calc-info-row-label">ערך</span>
            <span className="calc-info-row-value">{formatValue(view.value)}</span>
          </div>
        </div>

        {/* Formula section: arithmetic of the contributing values with
            the final = result. When refs have no numeric value (e.g.
            constant strings), fall back to the symbolic formula. */}
        <div className="calc-info-section">
          <div className="calc-info-section-title">חישוב</div>
          <div className="calc-info-formula">
            {buildArithmeticFormula(view) || view.formula || '—'}
          </div>
        </div>

        <div className="calc-info-section">
          <div className="calc-info-section-title">
            תאי מקור ({view.references.length})
          </div>
          {view.references.length === 0 ? (
            <div className="calc-info-note">לתא זה אין מקורות (תא בסיס).</div>
          ) : (
            <div className="calc-info-refs-grid">
              {view.references.map((entry, idx) => (
                <div
                  key={idx}
                  className="calc-info-ref-row"
                  onClick={() => onRefClick(entry)}
                  title={entry.sourceReport
                    ? `מעבר ל-${entry.sourceReport.display_label}`
                    : 'מקור לא ידוע'}
                >
                  <span className="calc-info-ref-report">
                    {entry.sourceReport
                      ? entry.sourceReport.display_label
                      : `דוח לא ידוע`}
                  </span>
                  <span className="calc-info-ref-col">
                    {entry.sourceColumnName || `עמודה ${entry.ref.c + 1}`}
                  </span>
                  <span className="calc-info-ref-row-idx">{entry.ref.i + 1}</span>
                  <span className="calc-info-ref-value">{formatValue(entry.ref.v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatValue(v) {
  if (v == null) return '—';
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return v.toLocaleString('en-US');
    return v.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return String(v);
}

/**
 * Render a sum-style arithmetic formula from the reference values:
 *   "21,000 + 9,000 = 30,000"
 * Falls back to null when:
 *   - no references
 *   - any ref value isn't numeric (mixed string/number/etc.)
 *   - the cell's own value isn't numeric
 * In any of those cases the caller renders the symbolic formula.
 */
function buildArithmeticFormula(view) {
  if (!view || !Array.isArray(view.references) || view.references.length === 0) return null;
  const nums = [];
  for (const entry of view.references) {
    const v = entry && entry.ref ? entry.ref.v : null;
    if (typeof v === 'number' && !Number.isNaN(v)) {
      nums.push(v);
    } else if (typeof v === 'string') {
      const parsed = parseFloat(v);
      if (!Number.isNaN(parsed) && v.trim() !== '') nums.push(parsed);
      else return null;
    } else {
      return null;
    }
  }
  if (nums.length === 0) return null;
  const own = typeof view.value === 'number'
    ? view.value
    : (typeof view.value === 'string' && !Number.isNaN(parseFloat(view.value))
       ? parseFloat(view.value) : null);
  if (own == null) return null;
  const parts = nums.map((n) => formatValue(n));
  return `${parts.join(' + ')} = ${formatValue(own)}`;
}
