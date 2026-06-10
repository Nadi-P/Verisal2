import React from 'react';
import { IconPlus } from '../../../../icons.jsx';
import DeviationItem from './DeviationItem/DeviationItem.jsx';
import { useDeviationColumnsLogic } from './DeviationColumns.logic.jsx';
import './DeviationColumns.css';

/**
 * Section below the Rows/Values zones for defining derived deviation columns.
 *
 * Props:
 *   config, onConfigChange — full preset config, mutated in place via setter.
 */
export default function DeviationColumns({ config, onConfigChange }) {
  const L = useDeviationColumnsLogic({ config, onConfigChange });
  const items = config.deviations || [];

  return (
    <div className="deviation-columns">
      <div className="deviation-columns-header">
        <span className="deviation-columns-title">סטיות</span>
        <button
          type="button"
          className="deviation-columns-add"
          onClick={L.addDeviation}
          title="הוסף סטייה"
        >
          <IconPlus size={12} />
          <span>הוסף</span>
        </button>
      </div>

      <div className="deviation-columns-list">
        {items.length === 0 ? (
          <div className="deviation-columns-empty">אין סטיות מוגדרות</div>
        ) : (
          items.map((d) => (
            <DeviationItem
              key={d.id}
              deviation={d}
              numericFields={L.numericFields}
              onChange={L.updateDeviation}
              onDelete={L.deleteDeviation}
            />
          ))
        )}
      </div>
    </div>
  );
}
