import React from 'react';
import { useColumnsPanel } from '../logic/ColumnsPanelLogic.jsx';
import '../style/ColumnsPanel.css';

function ColumnsPanel({ isOpen, columns, onApply, onCancel }) {
  const {
    localColumns,
    handleToggleVisible,
    handleTogglePin,
    handleToggleAll,
    allVisible,
    canApply,
    handleApply,
    handleCancel,
  } = useColumnsPanel(columns, onApply, onCancel);

  return (
    <div className={`columns-panel ${isOpen ? 'open' : ''}`}>
      <div className="columns-panel-header">
        <h3>ניהול עמודות</h3>
      </div>

      {/* Select All row */}
      <div className="columns-panel-select-all">
        <label className="col-checkbox-label">
          <input
            type="checkbox"
            checked={allVisible}
            onChange={handleToggleAll}
          />
          <span className="col-name">בחר הכל</span>
        </label>
      </div>

      <div className="columns-panel-list">
        {localColumns.map((col, i) => (
          <div key={col.id} className="columns-panel-item">
            <label className="col-checkbox-label">
              <input
                type="checkbox"
                checked={col.visible}
                onChange={() => handleToggleVisible(i)}
              />
              <span className="col-name" title={col.id}>{col.id}</span>
            </label>
            <button
              className={`pin-btn ${col.pinned ? 'pinned' : ''}`}
              onClick={() => handleTogglePin(i)}
              title={col.pinned ? 'בטל הקפאה' : 'הקפא עמודה'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill={col.pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
                <path d="M12 2l0 20M12 2l-4 4M12 2l4 4M5 12h14" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      <div className="columns-panel-footer">
        <button className="panel-btn apply-btn" onClick={handleApply} disabled={!canApply}>החל</button>
        <button className="panel-btn cancel-btn" onClick={handleCancel}>ביטול</button>
      </div>
    </div>
  );
}

export default ColumnsPanel;
