import React from 'react';
import ValueFilter                   from './ValueFilter/ValueFilter.jsx';
import FxConverter                   from './FxConverter/FxConverter.jsx';
import ConditionalHighlightSection   from './ConditionalHighlight/ConditionalHighlightSection.jsx';
import { useFieldConfigScreenLogic } from './FieldConfigScreen.logic.jsx';
import './FieldConfigScreen.css';

const DEV_FIELD_PREFIX = '__dev_';

function resolveDisplay(field, config) {
  if (!field || !field.startsWith(DEV_FIELD_PREFIX)) return field;
  const item = (config.values || []).find((v) => v && v.field === field);
  if (!item) return field;
  const base = item.name || '';
  return item.kind === 'percent' ? `${base} %`.trim() : base || '—';
}

/**
 * Screen 3 — per-field configuration.
 *
 * Sections (each gated by a top-left activate/deactivate button):
 *   - Value filter (always visible — uses its own checkbox UI)
 *   - FX conversion
 *   - Conditional highlighting (merged threshold + statistical)
 */
export default function FieldConfigScreen({
  field, zone, config, onConfigChange, uniqueValuesFor,
}) {
  const L = useFieldConfigScreenLogic({ field, config, onConfigChange });

  const isDeviation = field && field.startsWith(DEV_FIELD_PREFIX);
  const displayName = resolveDisplay(field, config);
  const uniqueValues = !isDeviation && uniqueValuesFor ? uniqueValuesFor(field) : [];

  const isNumeric = React.useMemo(() => {
    if (isDeviation) return true;
    if (uniqueValues.length === 0) return false;
    return uniqueValues.every((v) => {
      if (v === null || v === undefined || v === '') return true;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', ''));
      return !isNaN(n);
    });
  }, [uniqueValues, isDeviation]);

  const treatAsNumeric = zone === 'values' || isNumeric;

  return (
    <div className="field-config-screen">
      <div className="field-config-header">
        <span className="field-config-title">
          הגדרות שדה: <span className="field-config-field-name">{displayName}</span>
        </span>
      </div>

      <div className="field-config-body">
        {!isDeviation && (
          <ValueFilter
            uniqueValues={uniqueValues}
            filter={L.filter}
            onChange={L.setFilter}
          />
        )}

        {treatAsNumeric && (
          <>
            {!isDeviation && (
              <FxConverter fx={L.fx} onChange={L.setFx} />
            )}

            <ConditionalHighlightSection
              threshold={L.threshold}
              statHighlight={L.statHighlight}
              onChangeThreshold={L.setThreshold}
              onChangeStat={L.setStatHighlight}
              clearConditional={L.clearConditional}
            />
          </>
        )}

        {!treatAsNumeric && (
          <div className="field-config-note">
            שדה זה אינו מספרי — אפשרויות המרת מטבע והדגשה זמינות רק לשדות מספריים.
          </div>
        )}
      </div>
    </div>
  );
}
