import React from 'react';
import { IconDownload, IconSidebar } from '../../../components/icons.jsx';
import DisplayModeToggle from './DisplayModeToggle/DisplayModeToggle.jsx';
import { useReportTopBarLogic } from './ReportTopBar.logic.jsx';
import './ReportTopBar.css';

/**
 * Top bar of the report content area.
 *
 * Layout (DOM order; in RTL the title block visually sits on the right):
 *   [Title block]                                       [Controls cluster]
 *      report name
 *      date range mm/yyyy - mm/yyyy
 *      company name (accent)
 *                                                       Export ▾  |  Edit  |  Pivot/Table
 *
 * Props:
 *   reportTitle, metadata
 *   displayMode, onDisplayModeChange
 *   onToggleSidebar
 */
export default function ReportTopBar({
  reportTitle,
  metadata,
  displayMode,
  onDisplayModeChange,
  onToggleSidebar,
}) {
  const L = useReportTopBarLogic({ metadata });

  return (
    <div className="report-topbar">
      {/* ---- Title block ---- */}
      <div className="report-topbar-title-block">
        <h1 className="report-topbar-title">{reportTitle}</h1>
        <div className="report-topbar-subtitle">
          <span className="report-topbar-dates">{L.dateRange}</span>
          <span className="report-topbar-company">{L.companyName}</span>
        </div>
      </div>

      {/* ---- Controls cluster (visually on the left in RTL) ---- */}
      <div className="report-topbar-controls">
        <button
          type="button"
          className="report-topbar-btn report-topbar-btn-excel"
          title="ייצוא לאקסל"
        >
          <IconDownload size={16} />
          <span>ייצוא לאקסל</span>
        </button>

        <button
          type="button"
          className="report-topbar-btn report-topbar-btn-edit"
          onClick={onToggleSidebar}
          title="תפריט עריכה"
        >
          <IconSidebar size={16} />
          <span>תפריט עריכה</span>
        </button>

        <DisplayModeToggle
          value={displayMode}
          onChange={onDisplayModeChange}
        />
      </div>
    </div>
  );
}
