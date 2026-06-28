import React from 'react';
import ReactDOM from 'react-dom';
import { IconPlus } from '../../../../icons.jsx';
import DeviationItem from './DeviationItem/DeviationItem.jsx';
import ConfirmDialog from '../../ConfirmDialog/ConfirmDialog.jsx';
import { useDeviationColumnsLogic } from './DeviationColumns.logic.jsx';
import './DeviationColumns.css';

/**
 * Section below the Rows/Values zones for defining derived deviation columns.
 *
 * Delete protection: when the user clicks the trash on a deviation that
 * is "filled out" (both columns picked + a name set) we pop a confirm
 * dialog so the work isn't lost by accident. Half-filled rows delete
 * immediately, as before.
 */
export default function DeviationColumns({ config, onConfigChange }) {
  const L = useDeviationColumnsLogic({ config, onConfigChange });
  const items = config.deviations || [];
  const [confirm, setConfirm] = React.useState(null); // { id, label } | null

  const isFilled = (d) =>
    !!(d && d.sourceA && d.sourceB && d.name && d.name.trim());

  const requestDelete = (deviation) => {
    if (isFilled(deviation)) {
      setConfirm({ id: deviation.id, label: deviation.name.trim() });
    } else {
      L.deleteDeviation(deviation.id);
    }
  };

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
              onDelete={() => requestDelete(d)}
            />
          ))
        )}
      </div>

      {confirm && ReactDOM.createPortal(
        <ConfirmDialog
          title="מחיקת סטייה"
          message={`האם למחוק את הסטייה "${confirm.label}"? הפעולה אינה הפיכה.`}
          confirmLabel="מחק"
          variant="danger"
          onCancel={() => setConfirm(null)}
          onConfirm={() => {
            L.deleteDeviation(confirm.id);
            setConfirm(null);
          }}
        />,
        document.body,
      )}
    </div>
  );
}
