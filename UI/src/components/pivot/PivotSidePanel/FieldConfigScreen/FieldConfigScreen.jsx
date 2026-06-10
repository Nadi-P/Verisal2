import React from 'react';
import ValueFilter        from './ValueFilter/ValueFilter.jsx';
import FxConverter        from './FxConverter/FxConverter.jsx';
import ThresholdHighlight from './ThresholdHighlight/ThresholdHighlight.jsx';
import StatHighlight      from './StatHighlight/StatHighlight.jsx';
import { useFieldConfigScreenLogic } from './FieldConfigScreen.logic.jsx';
import './FieldConfigScreen.css';

const DEV_FIELD_PREFIX = '__dev_';

/**
 * Resolve a friendly display label for a field. Deviation fields get the
 * user-entered name (plus "%" for the percent kind); raw fields render their
 * own name.
 */
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
 * For deviation columns (synthetic __dev_* fields), the Value-filter and FX
 * sections are hidden — only Threshold and Stat-highlight apply.
 *
 * Props:
 *   field, zone
 *   config, onConfigChange
 *   uniqueValuesFor — (field) => unique values from the dataframe
 *   onBack          — kept for backward compat; back lives in TopBar now
 */
export default function FieldConfigScreen({
  field, zone, config, onConfigChange, uniqueValuesFor,
}) {
  const L = useFieldConfigScreenLogic({ field, config, onConfigChange });

  const isDeviation = field && field.startsWith(DEV_FIELD_PREFIX);
  const displayName = resolveDisplay(field, config);
  const uniqueValues = !isDeviation && uniqueValuesFor ? uniqueValuesFor(field) : [];

  // Heuristic: treat the field as numeric if every non-empty unique value
  // parses to a number. FX / threshold / stat highlight only show for numeric.
  const isNumeric = React.useMemo(() => {
    if (isDeviation) return true;                         // deviations are inherently numeric
    if (uniqueValues.length === 0) return false;
    return uniqueValues.every((v) => {
      if (v === null || v === undefined || v === '') return true;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', ''));
      return !isNaN(n);
    });
  }, [uniqueValues, isDeviation]);

  // For values zone, the field is always treated as numeric (it's being aggregated)
  const treatAsNumeric = zone === 'values' || isNumeric;

  return (
    <div className="field-config-screen">
      <div className="field-config-header">
        <span className="field-config-title">
          הגדרות שדה: <span className="field-config-field-name">{displayName}</span>
        </span>
      </div>

      <div className="field-config-body">
        {/* ValueFilter — hidden for deviation columns (no raw values to pick) */}
        {!isDeviation && (
          <ValueFilter
            uniqueValues={uniqueValues}
            filter={L.filter}
            onChange={L.setFilter}
          />
        )}

        {treatAsNumeric && (
          <>
            {/* FX — hidden for deviation columns */}
            {!isDeviation && (
              <div className="field-config-section">
                <div className="field-config-section-title">המרת מטבע</div>
                <FxConverter fx={L.fx} onChange={L.setFx} />
              </div>
            )}

            <div className="field-config-section">
              <div className="field-config-section-title">סף הדגשה</div>
              <ThresholdHighlight threshold={L.threshold} onChange={L.setThreshold} />
            </div>

            <div className="field-config-section">
              <div className="field-config-section-title">הדגשה סטטיסטית</div>
              <StatHighlight statHighlight={L.statHighlight} onChange={L.setStatHighlight} />
            </div>
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
