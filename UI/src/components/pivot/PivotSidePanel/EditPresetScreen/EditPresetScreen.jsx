import React from 'react';
import FieldBank from './FieldBank/FieldBank.jsx';
import DropZone from './DropZone/DropZone.jsx';
import ContextMenu from './ContextMenu/ContextMenu.jsx';
import DeviationColumns from './DeviationColumns/DeviationColumns.jsx';
import { useEditPresetScreenLogic } from './EditPresetScreen.logic.jsx';
import './EditPresetScreen.css';

/**
 * Screen 2 — drag/drop preset editor. Rows and Values only (no Columns).
 *
 * Props:
 *   allFields, uniqueValuesFor — passed through to children
 *   config, onConfigChange      — the live preset
 *   onOpenFieldConfig(zone, index, field) — invoked on double-click or
 *                                            context menu "Field settings"
 */
export default function EditPresetScreen({
  allFields,
  config,
  onConfigChange,
  appliedName,
  onOpenFieldConfig,
}) {
  const L = useEditPresetScreenLogic({ config, onConfigChange });

  const handleDoubleClick = (zone, index, field) => {
    onOpenFieldConfig?.(zone, index, field);
  };

  const handleContextOpenFieldConfig = () => {
    if (!L.menu) return;
    const { zone, index } = L.menu;
    const item = config[zone][index];
    const field = typeof item === 'string' ? item : item.field;
    onOpenFieldConfig?.(zone, index, field);
    L.closeContextMenu();
  };

  return (
    <div className="edit-preset-screen">
      <div className="edit-preset-header">
        <span className="edit-preset-header-label">תבנית בעריכה:
          <span className="edit-preset-header-name">
            {appliedName || 'ללא תבנית'}
          </span>
        </span>
      </div>

      <FieldBank
        allFields={allFields}
        usedFields={L.usedFields}
        onDragOver={L.handleDragOver}
        onDropToBank={L.handleDropToBank}
      />

      <div className="edit-preset-zones">
        <DropZone
          zone="rows"
          items={config.rows}
          filters={config.filters}
          onDrop={L.handleDrop}
          onContextMenu={L.openContextMenu}
          onDoubleClick={handleDoubleClick}
        />
        <DropZone
          zone="values"
          items={config.values}
          filters={config.filters}
          onDrop={L.handleDrop}
          onContextMenu={L.openContextMenu}
          onDoubleClick={handleDoubleClick}
        />
      </div>

      <DeviationColumns
        config={config}
        onConfigChange={onConfigChange}
      />

      {L.menu && (
        <ContextMenu
          x={L.menu.x}
          y={L.menu.y}
          zone={L.menu.zone}
          item={config[L.menu.zone][L.menu.index]}
          onClose={L.closeContextMenu}
          onMoveUp={()    => { L.moveWithin(L.menu.zone, L.menu.index, -1); L.closeContextMenu(); }}
          onMoveDown={()  => { L.moveWithin(L.menu.zone, L.menu.index, +1); L.closeContextMenu(); }}
          onMoveStart={() => { L.moveTo(L.menu.zone, L.menu.index, 'start'); L.closeContextMenu(); }}
          onMoveEnd={()   => { L.moveTo(L.menu.zone, L.menu.index, 'end');   L.closeContextMenu(); }}
          onTransferRows={()   => { L.transferTo(L.menu.zone, L.menu.index, 'rows');   L.closeContextMenu(); }}
          onTransferValues={() => { L.transferTo(L.menu.zone, L.menu.index, 'values'); L.closeContextMenu(); }}
          onOpenFieldConfig={handleContextOpenFieldConfig}
          onSetAggregation={(agg) => { L.setAggregation(L.menu.index, agg); L.closeContextMenu(); }}
          onRemove={() => { L.removeItem(L.menu.zone, L.menu.index); L.closeContextMenu(); }}
        />
      )}
    </div>
  );
}
