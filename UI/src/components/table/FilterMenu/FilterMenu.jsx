import React from 'react';
import { createPortal } from 'react-dom';
import { useFilterMenu } from './FilterMenu.logic.jsx';
import './FilterMenu.css';

function FilterMenu({ columnId, allValues, currentFilter, onApply, onCancel, position }) {
  const {
    checked,
    allChecked,
    hasAnyChecked,
    handleToggle,
    handleSelectAll,
    handleApply,
  } = useFilterMenu(allValues, currentFilter, onApply);

  return createPortal(
    <div
      className="filter-menu"
      style={{
        top:   position?.top,
        left:  position?.left,
        right: position?.right,
      }}
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
    </div>,
    document.body
  );
}

export default FilterMenu;
