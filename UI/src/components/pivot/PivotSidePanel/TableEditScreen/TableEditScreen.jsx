import React, { useState, useMemo, useCallback } from 'react';
import ColumnList from './ColumnList/ColumnList.jsx';
import DeviationColumns from '../EditPresetScreen/DeviationColumns/DeviationColumns.jsx';
import FilterMenu from '../../../table/FilterMenu/FilterMenu.jsx';
import { IconSearch } from '../../../icons.jsx';
import { useTableEditScreenLogic } from './TableEditScreen.logic.jsx';
import './TableEditScreen.css';

const DEV_FIELD_PREFIX = '__dev_';

// Expand each deviation into 0, 1, or 2 synthetic field ids — one per
// (deviation × kind) where the corresponding checkbox is on. Mirrors the
// expansion in TableView so the column list matches the rendered columns.
function expandDeviationsForList(deviations) {
  const out = [];
  for (const d of deviations || []) {
    if (!d || !d.id) continue;
    if (d.showDiff)    out.push({ id: d.id, kind: 'diff',    name: d.name, fieldId: `${DEV_FIELD_PREFIX}${d.id}_diff` });
    if (d.showPercent) out.push({ id: d.id, kind: 'percent', name: d.name, fieldId: `${DEV_FIELD_PREFIX}${d.id}_percent` });
  }
  return out;
}

/**
 * Table-mode edit screen.
 *
 * DOM shape intentionally mirrors `EditPresetScreen` — same outer classes,
 * same header treatment — so the pivot side-panel stylesheets apply 1:1
 * with no visual divergence between modes.
 *
 * Table-specific content (the search bar + draggable column list) lives
 * inside an additional wrapper that styles itself independently while
 * staying within the same screen frame.
 */
export default function TableEditScreen({
  allFields,
  uniqueValuesFor,
  config,
  onConfigChange,
  appliedName,
  onOpenFieldConfig,
}) {
  // Synthesize deviation field ids from config so they appear in the column list.
  // One id per (deviation × kind) where the corresponding checkbox is ticked.
  const expandedDeviations = useMemo(
    () => expandDeviationsForList(config.deviations),
    [config.deviations]
  );
  const deviationFields = useMemo(
    () => expandedDeviations.map((d) => d.fieldId),
    [expandedDeviations]
  );

  // Build a display-name lookup so deviation rows show the user-set name
  // (not the raw __dev_<id>_kind token).
  const labelFor = useMemo(() => {
    const map = new Map();
    for (const dev of expandedDeviations) {
      map.set(dev.fieldId, dev.kind === 'percent' ? `${dev.name || ''} %`.trim() : (dev.name || '—'));
    }
    return (id) => map.get(id) || id;
  }, [expandedDeviations]);

  const L = useTableEditScreenLogic({
    allFields, deviationFields, config, onConfigChange,
  });

  const [query, setQuery] = useState('');
  const isSearching = query.trim().length > 0;

  // ---- FilterMenu (opened from the column-list right-click menu) -------
  // Mirrors AuditTable's filter shape adapter — pivot stores `allowed[]`,
  // FilterMenu speaks "excluded set", so we convert at both boundaries.
  const [filterMenu, setFilterMenu] = useState(null);
  // shape: { columnId, position: { top, left } }

  const openFilterFor = useCallback((columnId, position) => {
    setFilterMenu({ columnId, position });
  }, []);
  const closeFilterMenu = useCallback(() => setFilterMenu(null), []);

  const handleFilterApply = useCallback((columnId, allowedArray) => {
    const filters = { ...(config.filters || {}) };
    if (!allowedArray || allowedArray.length === 0) {
      delete filters[columnId];
    } else {
      filters[columnId] = allowedArray;
    }
    onConfigChange({ ...config, filters });
    closeFilterMenu();
  }, [config, onConfigChange, closeFilterMenu]);

  const filteredItems = useMemo(() => {
    if (!isSearching) return L.items;
    const q = query.trim().toLowerCase();
    return L.items.filter((it) => labelFor(it.id).toLowerCase().includes(q));
  }, [query, isSearching, L.items, labelFor]);

  return (
    <div className="edit-preset-screen">
      <div className="edit-preset-header">
        <span className="edit-preset-header-label">
          תבנית בעריכה:
          <span className="edit-preset-header-name">
            {appliedName || 'ללא תבנית'}
          </span>
        </span>
      </div>

      {/* Bank-style container — same shell as `field-bank` in pivot mode,
          so the search bar + list share the visual treatment exactly. */}
      <div className="field-bank column-list-container">
        <div className="field-bank-search">
          <IconSearch size={14} />
          <input
            type="text"
            placeholder="חיפוש עמודה..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <ColumnList
          items={filteredItems}
          sortBy={L.sortBy}
          labelFor={labelFor}
          dragDisabled={isSearching}
          onTogglePin={L.togglePin}
          onToggleVisible={L.toggleVisible}
          onMoveItem={L.moveItem}
          onMoveItemBy={L.moveItemBy}
          onSetSortDirect={L.setSortDirect}
          onOpenFilter={openFilterFor}
          onClickItem={(id) => onOpenFieldConfig('table', null, id)}
        />
      </div>

      {/* Deviation columns editor — identical to pivot mode. */}
      <DeviationColumns
        config={config}
        onConfigChange={onConfigChange}
      />

      {filterMenu && (() => {
        const allValues = uniqueValuesFor ? uniqueValuesFor(filterMenu.columnId) : [];
        const allowed   = (config.filters || {})[filterMenu.columnId];
        const excludedSet = (() => {
          if (!Array.isArray(allowed)) return new Set();
          const allowSet = new Set(allowed.map(String));
          return new Set(allValues.map(String).filter((v) => !allowSet.has(v)));
        })();
        return (
          <FilterMenu
            columnId={labelFor(filterMenu.columnId)}
            allValues={allValues}
            currentFilter={excludedSet}
            position={filterMenu.position}
            onApply={(nextExcluded) => {
              const allowedNext = allValues
                .map(String)
                .filter((v) => !nextExcluded.has(v));
              handleFilterApply(filterMenu.columnId, allowedNext);
            }}
            onCancel={closeFilterMenu}
          />
        );
      })()}
    </div>
  );
}
