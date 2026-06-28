import React, { useMemo } from 'react';
import ValueFilter                  from '../FieldConfigScreen/ValueFilter/ValueFilter.jsx';
import FxConverter                  from '../FieldConfigScreen/FxConverter/FxConverter.jsx';
import ConditionalHighlightSection  from '../FieldConfigScreen/ConditionalHighlight/ConditionalHighlightSection.jsx';
import {
  IconEye, IconEyeOff,
  IconPin, IconPinOff,
  IconSortAsc, IconSortDesc, IconSortNone,
} from '../../../icons.jsx';
import { useTableFieldConfigScreenLogic } from './TableFieldConfigScreen.logic.jsx';
import './TableFieldConfigScreen.css';

const DEV_FIELD_PREFIX = '__dev_';

function resolveDisplay(field, config) {
  if (!field || !field.startsWith(DEV_FIELD_PREFIX)) return field;
  // Field id is `__dev_<deviationId>_<kind>` where <kind> is 'diff' or 'percent'.
  const rest = field.slice(DEV_FIELD_PREFIX.length);
  // Match the longest suffix that is a recognized kind.
  const m = rest.match(/^(.+)_(diff|percent)$/);
  if (!m) return field;
  const [, devId, kind] = m;
  const item = (config.deviations || []).find((d) => d && d.id === devId);
  if (!item) return field;
  const base = item.name || '';
  return kind === 'percent' ? `${base} %`.trim() : base || '—';
}

/**
 * Table-mode per-column config screen.
 *
 * DOM shape mirrors `FieldConfigScreen` — same outer classes (`field-config-*`)
 * so the existing pivot stylesheet styles the header, body, sections, and
 * note exactly the same way for both modes.
 *
 * Table-only content:
 *   - Row of three big buttons (Visibility / Sort / Pin), icon-over-text.
 *     Sort: left-click = forward cycle, right-click = backward cycle.
 *   - Filter + FX sections are shared with pivot via `config.filters` /
 *     `config.fxConversions`.
 */
export default function TableFieldConfigScreen({
  field, config, onConfigChange, uniqueValuesFor,
}) {
  const L = useTableFieldConfigScreenLogic({ field, config, onConfigChange });

  const displayName  = resolveDisplay(field, config);
  const uniqueValues = !L.isDeviation && uniqueValuesFor ? uniqueValuesFor(field) : [];

  const isNumeric = useMemo(() => {
    if (L.isDeviation) return true;
    if (uniqueValues.length === 0) return false;
    return uniqueValues.every((v) => {
      if (v === null || v === undefined || v === '') return true;
      const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', ''));
      return !isNaN(n);
    });
  }, [uniqueValues, L.isDeviation]);

  const sortIcon =
    L.sortDir === 'asc'  ? <IconSortAsc  size={22} /> :
    L.sortDir === 'desc' ? <IconSortDesc size={22} /> :
                            <IconSortNone size={22} />;
  const sortLabel =
    L.sortDir === 'asc'  ? 'ממוין עולה' :
    L.sortDir === 'desc' ? 'ממוין יורד' :
                            'ללא מיון';

  return (
    <div className="field-config-screen">
      <div className="field-config-header">
        <span className="field-config-title">
          הגדרות עמודה:
          <span className="field-config-field-name">{displayName}</span>
        </span>
      </div>

      <div className="field-config-body">
        {/* Three big action buttons — table-mode-only block */}
        <div className="tfc-actions">
          <button
            className={`tfc-action ${L.visible ? 'active' : ''}`}
            onClick={L.toggleVisible}
          >
            {L.visible ? <IconEye size={22} /> : <IconEyeOff size={22} />}
            <span className="tfc-action-label">{L.visible ? 'מוצג' : 'מוסתר'}</span>
          </button>

          <button
            className={`tfc-action ${L.sortDir ? 'active' : ''}`}
            onClick={() => L.cycleSort('forward')}
            onContextMenu={(e) => { e.preventDefault(); L.cycleSort('back'); }}
          >
            {sortIcon}
            <span className="tfc-action-label">{sortLabel}</span>
          </button>

          <button
            className={`tfc-action ${L.pinned ? 'active' : ''}`}
            onClick={L.togglePin}
          >
            {L.pinned ? <IconPin size={22} /> : <IconPinOff size={22} />}
            <span className="tfc-action-label">{L.pinned ? 'מוקפא' : 'לא מוקפא'}</span>
          </button>
        </div>

        {/* ValueFilter — hidden for deviation columns (no raw values to pick) */}
        {!L.isDeviation && (
            <ValueFilter
              uniqueValues={uniqueValues}
              filter={L.filter}
              onChange={L.setFilter}
            />
        )}

        {/* FX + Conditional highlight — hidden for deviation columns */}
        {isNumeric && !L.isDeviation && (
          <>
            <FxConverter fx={L.fx} onChange={L.setFx} />
            <ConditionalHighlightSection
              threshold={L.threshold}
              statHighlight={L.statHighlight}
              onChangeThreshold={L.setThreshold}
              onChangeStat={L.setStatHighlight}
              clearConditional={L.clearConditional}
            />
          </>
        )}

        {!isNumeric && !L.isDeviation && (
          <div className="field-config-note">
            שדה זה אינו מספרי — המרת מטבע והדגשה זמינות רק לשדות מספריים.
          </div>
        )}
      </div>
    </div>
  );
}
