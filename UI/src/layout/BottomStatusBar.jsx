import React from 'react';
import '../style/BottomStatusBar.css';

function BottomStatusBar({ zoom, setZoom, selectionStats, disabled }) {
  const handleZoomChange = (e) => {
    setZoom(Number(e.target.value));
  };

  const renderStats = () => {
    if (!selectionStats) return <span className="stats-placeholder">בחר תאים להצגת נתונים</span>;

    if (selectionStats.type === 'single') {
      return (
        <div className="stats-group">
          <span className="stat-item"><span className="stat-label">עמודה:</span> {selectionStats.label}</span>
          <span className="stat-divider">|</span>
          <span className="stat-item"><span className="stat-label">ערך:</span> {selectionStats.value}</span>
        </div>
      );
    }

    if (selectionStats.type === 'multi') {
      return (
        <div className="stats-group">
          {selectionStats.count !== undefined && (
            <span className="stat-item"><span className="stat-label">תאים:</span> {selectionStats.count}</span>
          )}
          {selectionStats.sum !== null && selectionStats.sum !== undefined && (
            <>
              <span className="stat-divider">|</span>
              <span className="stat-item"><span className="stat-label">סכום:</span> {selectionStats.sum}</span>
            </>
          )}
          {selectionStats.avg !== null && selectionStats.avg !== undefined && (
            <>
              <span className="stat-divider">|</span>
              <span className="stat-item"><span className="stat-label">ממוצע:</span> {selectionStats.avg}</span>
            </>
          )}
          {selectionStats.ratio !== null && selectionStats.ratio !== undefined && (
            <>
              <span className="stat-divider">|</span>
              <span className="stat-item"><span className="stat-label">יחס:</span> {selectionStats.ratio}%</span>
            </>
          )}
        </div>
      );
    }
    return null;
  };

  return (
    <footer className="bottom-status-bar">
      <div className="zoom-control">
        <button className="zoom-btn" onClick={() => setZoom(z => Math.max(50, z - 5))} title="הקטן" disabled={disabled}>−</button>
        <input
          type="range"
          className="zoom-slider"
          min="50"
          max="200"
          value={zoom}
          onChange={handleZoomChange}
          disabled={disabled}
        />
        <button className="zoom-btn" onClick={() => setZoom(z => Math.min(200, z + 5))} title="הגדל" disabled={disabled}>+</button>
        <span className="zoom-label">{zoom}%</span>
      </div>
      <div className="selection-stats">
        {renderStats()}
      </div>
    </footer>
  );
}

export default BottomStatusBar;
