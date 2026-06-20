import React, { useState } from 'react';
import './ReportStatusCard.css';

/**
 * One card per Report on the upload-management page.
 *
 * Colour + label are driven by `card_status` from the backend:
 *   ok                 → green  · "תקין"
 *   missing            → red    · "חסר"            (input file not uploaded)
 *   missing_dependency → red    · "תלות חסרה"      (a dependency is missing)
 *   inconsistent       → yellow · "לא עקבי"        (company / range mismatch)
 *
 * Body shows: date range, company name, rows × cols, dependencies (by
 * display name). A missing-dependency line is bold-red; inconsistency
 * reasons are bold-yellow at the bottom. Cards fade in, staggered by index.
 */
export default function ReportStatusCard({ report, index = 0 }) {
  const [excOpen, setExcOpen] = useState(false);

  const cardStatus  = report.card_status || 'ok';
  const deps        = report.dependencies_display || [];
  const missingDeps = report.missing_dependencies_display || [];
  const reasons     = report.inconsistency_reasons || [];
  const hasExc      = (report.exceptions || []).length > 0;

  return (
    <div className={`report-status-card card-${cardStatus}`} style={{ '--i': index }}>
      <div className="rsc-head">
        <span className="rsc-display-label">{report.display_label || report.id}</span>
        <StatusBadge status={cardStatus} />
      </div>

      <div className="rsc-body">
        <div className="rsc-row">
          <span className="rsc-row-label">טווח תאריכים</span>
          <span className="rsc-row-value">{formatRange(report)}</span>
        </div>

        <div className="rsc-row">
          <span className="rsc-row-label">שם חברה</span>
          <span className="rsc-row-value">{report.company_name || '—'}</span>
        </div>

        <div className="rsc-row">
          <span className="rsc-row-label">שורות × עמודות</span>
          <span className="rsc-row-value">
            {report.rows_count}
            <span className="rsc-row-sep"> × </span>
            {report.columns_count}
          </span>
        </div>

        {deps.length > 0 && (
          <div className="rsc-row">
            <span className="rsc-row-label">תלויות ב</span>
            <span className="rsc-row-value">{deps.join(', ')}</span>
          </div>
        )}
      </div>

      {missingDeps.length > 0 && (
        <div className="rsc-note rsc-note-missing">
          תלויות חסרות: {missingDeps.join(', ')}
        </div>
      )}

      {cardStatus === 'inconsistent' && reasons.length > 0 && (
        <div className="rsc-note rsc-note-inconsistent">
          {reasons.map((msg, i) => (
            <div key={i} className="rsc-note-line">{msg}</div>
          ))}
        </div>
      )}

      {hasExc && (
        <div className="rsc-exceptions">
          <button
            type="button"
            className="rsc-exceptions-toggle"
            onClick={() => setExcOpen((v) => !v)}
          >
            {excOpen ? 'הסתר שגיאות' : `הצג שגיאות (${report.exceptions.length})`}
          </button>
          {excOpen && (
            <ul className="rsc-exceptions-list">
              {report.exceptions.map((msg, idx) => (
                <li key={idx} className="rsc-exceptions-item">{msg}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function formatRange(r) {
  const { min_month: mm, min_year: my, max_month: xm, max_year: xy } = r;
  if (mm == null || my == null || xm == null || xy == null) return '—';
  if (mm === xm && my === xy) return `${mm}/${my}`;
  return `${mm}/${my} – ${xm}/${xy}`;
}

function StatusBadge({ status }) {
  const label =
    status === 'ok'                 ? 'תקין' :
    status === 'missing'            ? 'חסר' :
    status === 'missing_dependency' ? 'תלות חסרה' :
    status === 'inconsistent'       ? 'לא עקבי' :
                                      '—';
  return <span className={`rsc-badge rsc-badge-${status}`}>{label}</span>;
}
