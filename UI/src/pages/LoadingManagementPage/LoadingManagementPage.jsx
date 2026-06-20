import React from 'react';
import { useUploadManager } from '../../contexts/UploadManagerContext.jsx';
import { bucketReports } from '../../lib/uploadManager.js';
import PagePlaceholder from '../../components/ui/PagePlaceholder/PagePlaceholder.jsx';
import { IconLoading } from '../../components/icons.jsx';
import ReportStatusCard from './ReportStatusCard/ReportStatusCard.jsx';
import './LoadingManagementPage.css';

/**
 * Real per-report status display, sourced from UploadManager.
 *
 * Two sections (system inputs first, then manufactured). Each section
 * lists every Report the backend tried to build, with status badge,
 * shape (rows × cols), dependencies, missing-deps, skipped-steps, and
 * an exceptions list (one collapsible card per Report).
 *
 * Empty state when no upload has happened yet.
 */
export default function LoadingManagementPage() {
  const { payload, hydrating } = useUploadManager();

  if (hydrating) {
    return (
      <div className="loading-management-page">
        <PagePlaceholder
          icon={<IconLoading size={48} />}
          title="ניהול טעינה"
          subtitle="טוען נתוני העלאה..."
        />
      </div>
    );
  }

  if (!payload || !payload.reports) {
    return (
      <div className="loading-management-page">
        <PagePlaceholder
          icon={<IconLoading size={48} />}
          title="ניהול טעינה"
          subtitle="לא נטענה תיקיית דוחות. השתמש בכפתור 'העלאת קבצים' בסרגל הצד כדי להתחיל."
        />
      </div>
    );
  }

  const { system, manufactured } = bucketReports(payload);
  const meta = payload.metadata || {};
  const unrecognized = payload.unrecognized || [];
  const duplicates   = payload.duplicates   || [];

  return (
    <div className="loading-management-page">
      <div className="lmp-header">
        <h1 className="lmp-title">ניהול טעינה</h1>
        <div className="lmp-meta">
          {meta.company_name && (
            <span className="lmp-meta-item">
              <span className="lmp-meta-label">חברה:</span>{' '}
              <span className="lmp-meta-value">{meta.company_name}</span>
            </span>
          )}
          {(meta.min_month != null && meta.max_month != null) && (
            <span className="lmp-meta-item">
              <span className="lmp-meta-label">תקופה:</span>{' '}
              <span className="lmp-meta-value">
                 {meta.max_month}/{meta.max_year} - {meta.min_month}/{meta.min_year}
              </span>
            </span>
          )}
        </div>
      </div>

      {(unrecognized.length > 0 || duplicates.length > 0) && (
        <div className="lmp-warnings">
          {unrecognized.length > 0 && (
            <div className="lmp-warning">
              <strong>קבצים לא מזוהים:</strong> {unrecognized.join(', ')}
            </div>
          )}
          {duplicates.length > 0 && (
            <div className="lmp-warning">
              <strong>כפילויות:</strong> {duplicates.join(', ')}
            </div>
          )}
        </div>
      )}

      <section className="lmp-section">
        <h2 className="lmp-section-title">דוחות מערכת</h2>
        <div className="lmp-grid">
          {system.length === 0 ? (
            <div className="lmp-empty">לא נטענו דוחות מערכת</div>
          ) : (
            system.map((r, i) => <ReportStatusCard key={r.id} report={r} index={i} />)
          )}
        </div>
      </section>

      <section className="lmp-section">
        <h2 className="lmp-section-title">דוחות מיוצרים</h2>
        <div className="lmp-grid">
          {manufactured.length === 0 ? (
            <div className="lmp-empty">לא נטענו דוחות מיוצרים</div>
          ) : (
            manufactured.map((r, i) => (
              <ReportStatusCard key={r.id} report={r} index={system.length + i} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}
