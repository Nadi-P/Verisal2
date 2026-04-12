import React from 'react';
import { useFilterMenu } from '../logic/FilterMenuLogic.jsx';
import '../style/FilterMenu.css';

function FilterMenu({ columnId, allValues, currentFilter, onApply, onCancel, position }) {
  const {
    checked,
    allChecked,
    hasAnyChecked,
    handleToggle,
    handleSelectAll,
    handleApply,
  } = useFilterMenu(allValues, currentFilter, onApply);

  return (
    <div className="filter-menu-overlay" onClick={onCancel}>
      <div
        className="filter-menu"
        style={{ top: position?.top, left: position?.left }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="filter-menu-header">
          <span>סינון: {columnId}</span>
        </div>
        <div className="filter-select-all">
          <label>
            <input
              type="checkbox"
              checked={allChecked}
              onChange={handleSelectAll}
            />
            <span>בחר הכל</span>
          </label>
        </div>
        <div className="filter-menu-list">
          {allValues.map((val, i) => (
            <label key={i} className="filter-menu-item">
              <input
                type="checkbox"
                checked={checked[i] ?? true}
                onChange={() => handleToggle(i)}
              />
              <span className="filter-val-text">{String(val)}</span>
            </label>
          ))}
        </div>
        <div className="filter-menu-footer">
          <button
            className="filter-btn apply"
            onClick={handleApply}
            disabled={!hasAnyChecked}
            title={hasAnyChecked ? 'החל סינון' : 'יש לבחור לפחות ערך אחד'}
          >
            החל
          </button>
          <button className="filter-btn cancel" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    </div>
  );
}

export default FilterMenu;
