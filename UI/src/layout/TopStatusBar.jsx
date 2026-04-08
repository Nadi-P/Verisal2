import React from 'react';
import '../style/TopStatusBar.css';

function TopStatusBar({ metadata, currentReport, columnsPanelOpen, onToggleColumnsPanel }) {
  return (
    <header className="top-status-bar">
      <div className="top-bar-right">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{display: 'flex', flexDirection: 'row',alignItems: 'center', gap: '1rem'}}>
            <h1 className="company-name">{metadata.companyName || 'מערכת בדיקת שכר'}</h1>
            <span className="date-range">{metadata.dateRange}</span>
          </div>
          <div className="current-report">{currentReport || 'נא לבחור דוח'}</div>
        </div>
      </div>
      <button
        className={`columns-panel-toggle ${columnsPanelOpen ? 'active' : ''}`}
        onClick={onToggleColumnsPanel}
        title="ניהול עמודות"
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
