import React from 'react';
import { useTopStatusBarLogic } from '../logic/TopStatusBarLogic.jsx';
import '../style/TopStatusBar.css';

function TopStatusBar({
  metadata, currentReport, columns, onToggleColumns,
  columnsPanelOpen, onRunComparison, compData, setCompData,
  onClearFilters, hasActiveFilters, onExportExcel
}) {
  const { 
    handleCompChange, isComparisonValid, handleRunComparison 
  } = useTopStatusBarLogic(metadata, onRunComparison, compData, setCompData);

  const isComparisonMode = currentReport === "השוואת חודשים" || currentReport === "Months Comparison";

  return (
    <header className="top-status-bar" dir="rtl">
      <div className="top-bar-right">
        <div className="title-group">
          <div className="main-meta">
            <h1 className="company-name">{metadata.companyName || 'מערכת בדיקת שכר'}</h1>
            <span className="date-range">{metadata.dateRange}</span>
          </div>
          <div className="current-report">{currentReport || 'נא לבחור דוח'}</div>
        </div>

        {isComparisonMode && (
          <div className="comparison-controls fade-in-content">
            <div className="input-pair">
              <label>חודש/שנה א':</label>
              <input name="m1" value={compData.m1} onChange={handleCompChange} placeholder="MM" className="mini-input" />
              <input name="y1" value={compData.y1} onChange={handleCompChange} placeholder="YYYY" className="mini-input year" />
            </div>
            <div className="input-pair">
              <label>חודש/שנה ב':</label>
              <input name="m2" value={compData.m2} onChange={handleCompChange} placeholder="MM" className="mini-input" />
              <input name="y2" value={compData.y2} onChange={handleCompChange} placeholder="YYYY" className="mini-input year" />
            </div>
            <button 
              className="apply-comparison-btn" 
              disabled={!isComparisonValid}
              onClick={handleRunComparison}
            >
              החל השוואה
            </button>
          </div>
        )}
      </div>

      <div className="top-bar-actions">
        <button
          className="top-bar-btn clear-filters-btn"
          onClick={onClearFilters}
          disabled={!hasActiveFilters}
          title={hasActiveFilters ? 'נקה את כל הסינונים' : 'אין סינונים פעילים'}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            <line x1="3" y1="21" x2="21" y2="3" />
          </svg>
          <span>נקה סינון</span>
        </button>

        <button
          className={`top-bar-btn columns-panel-toggle ${columnsPanelOpen ? 'active' : ''}`}
          onClick={onToggleColumns}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="18" rx="1" />
          </svg>
          <span>עמודות</span>
        </button>

        <button
          className="top-bar-btn export-excel-btn"
          onClick={onExportExcel}
          title="ייצוא לאקסל"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          <span>ייצוא לאקסל</span>
        </button>
      </div>
    </header>
  );
}

export default TopStatusBar;

      