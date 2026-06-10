import React from 'react';
import { IconSearch } from '../../../../icons.jsx';
import { useFieldBankLogic } from './FieldBank.logic.jsx';
import './FieldBank.css';

/**
 * Field bank: searchable list of fields not currently used by any drop zone.
 * Dragging back to the bank from a zone removes the field from that zone
 * (the drop handler lives on this component's list).
 */
export default function FieldBank({ allFields, usedFields, onDropToBank, onDragOver }) {
  const L = useFieldBankLogic({ allFields, usedFields });

  return (
    <div className="field-bank">
      <div className="field-bank-search">
        <IconSearch size={14} />
        <input
          type="text"
          placeholder="חפש שדה..."
          value={L.query}
          onChange={(e) => L.setQuery(e.target.value)}
        />
      </div>
      <div
        className="field-bank-list"
        onDragOver={onDragOver}
        onDrop={onDropToBank}
      >
        {L.availableFields.length === 0 ? (
          <div className="field-bank-empty">אין שדות זמינים</div>
        ) : (
          L.availableFields.map((field) => (
            <div
              key={field}
              className="field-bank-item"
              draggable
              onDragStart={(e) => L.handleDragStart(e, field)}
            >
              {field}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
