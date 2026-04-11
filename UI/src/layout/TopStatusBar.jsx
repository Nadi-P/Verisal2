import React from 'react';
import { useTopStatusBarLogic } from '../logic/TopStatusBarLogic.jsx';
import '../style/TopStatusBar.css';

function TopStatusBar({ 
  metadata, currentReport, columns, onToggleColumns, 
  columnsPanelOpen, onRunComparison, compData, setCompData 
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

      <button
        className={`columns-panel-toggle ${columnsPanelOpen ? 'active' : ''}`}
        onClick={onToggleColumns}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="18" rx="1" />
        </svg>
        <span>עמודות</span>
      </button>
    </header>
  );
}

export default TopStatusBar;

      