import React from 'react';
import { IconSearch } from '../../../../icons.jsx';
import { useValueFilterLogic } from './ValueFilter.logic.jsx';
import './ValueFilter.css';

/**
 * Value-filter section. Searchable checklist of unique values for this field.
 *
 * Props:
 *   uniqueValues — array of unique values for the field
 *   filter       — undefined (all) | string[] (allowed)
 *   onChange     — replace the filter
 */
export default function ValueFilter({ uniqueValues, filter, onChange }) {
  const L = useValueFilterLogic({ uniqueValues, filter, onChange });

  return (
    <section className="value-filter">
      {/* Title row: section label + Select/Clear actions, all above the search */}
      <div className="value-filter-header">
        <span className="value-filter-title">סינון ערכים</span>
        <div className="value-filter-actions">
          <button type="button" className="value-filter-btn value-filter-btn-ghost" onClick={L.clearAll}>נקה</button>
          <button type="button" className="value-filter-btn" onClick={L.selectAll}>בחר הכל</button>
        </div>
      </div>
      <div className="value-filter-search">
        <IconSearch size={14} />
        <input
          type="text"
          placeholder="חפש ערך..."
          value={L.query}
          onChange={(e) => L.setQuery(e.target.value)}
        />
      </div>
      <div className="value-filter-list">
        {L.filtered.length === 0 ? (
          <div className="value-filter-empty">אין ערכים</div>
        ) : (
          L.filtered.map((v) => (
            <label key={String(v)} className="value-filter-row">
              <input
                type="checkbox"
                checked={L.isSelected(v)}
                onChange={() => L.toggle(v)}
              />
              <span>{String(v)}</span>
            </label>
          ))
        )}
      </div>
    </section>
  );
}
