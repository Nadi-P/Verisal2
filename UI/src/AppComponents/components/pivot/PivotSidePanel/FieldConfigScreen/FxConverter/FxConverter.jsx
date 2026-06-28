import React from 'react';
import ReactDOM from 'react-dom';
import { useFxConverterLogic } from './FxConverter.logic.jsx';
import SectionShell from '../SectionShell.jsx';
import Flag from '../../../../../pages/FxManagementPage/Flag.jsx';
import AddRateDialog from '../../../../../pages/FxManagementPage/AddRateDialog.jsx';
import ConfirmDialog from '../../ConfirmDialog/ConfirmDialog.jsx';
import {
  CURRENCY_BY_CODE, MONTH_NAMES_HE,
} from '../../../../../pages/FxManagementPage/currencies.js';
import { IconPlus } from '../../../../icons.jsx';

/**
 * Self-contained FX-conversion section. Owns its hook so head + body
 * see the same rates cache (a rate added via the dialog instantly
 * shows up in the year/month selects). All dialogs are portaled to
 * <body> so they overlay the main content area, not the side panel.
 *
 * Props:
 *   fx       — { currency, direction, month, year } or null
 *   onChange — replace the fx slot (null deactivates)
 */
export default function FxConverter({ fx, onChange }) {
  const L = useFxConverterLogic({ fx, onChange });
  const [addOpen, setAddOpen] = React.useState(false);
  const [confirm, setConfirm] = React.useState(null);

  const active = !!fx;
  const onToggle = () => {
    if (active) onChange(null);
    else onChange({
      currency: '', direction: 'toIls',
      month: new Date().getMonth() + 1,
      year:  new Date().getFullYear(),
    });
  };

  // Only the add-rate icon sits in the head now. The direction toggle is
  // a labeled button in the body (per spec).
  const headActions = (
    <button
      type="button"
      className="fc-head-icon-btn"
      title="הוסף שער"
      aria-label="הוסף שער"
      onClick={() => setAddOpen(true)}
    >
      <IconPlus size={16} />
    </button>
  );

  return (
    <>
      <SectionShell
        title="המרת מטבע"
        active={active}
        onToggle={onToggle}
        headActions={headActions}
      >
        <FxBody fx={fx} L={L} />
      </SectionShell>

      {addOpen && ReactDOM.createPortal(
        <AddRateDialog
          initialCurrency={fx?.currency || null}
          findRate={L.findRate}
          onClose={() => setAddOpen(false)}
          onSave={async (payload) => {
            const existing = L.findRate(payload.currency, payload.year, payload.month);
            if (existing) { setConfirm({ payload }); return; }
            const ok = await L.persistRate(payload);
            if (ok) setAddOpen(false);
          }}
        />,
        document.body,
      )}
      {confirm && ReactDOM.createPortal(
        <ConfirmDialog
          title="אישור דריסה"
          message={`קיים כבר שער למטבע ${confirm.payload.currency} בתאריך ${String(confirm.payload.month).padStart(2,'0')}/${confirm.payload.year}. האם לדרוס אותו?`}
          confirmLabel="אשר ודרוס"
          variant="danger"
          onCancel={() => setConfirm(null)}
          onConfirm={async () => {
            const ok = await L.persistRate(confirm.payload);
            setConfirm(null);
            if (ok) setAddOpen(false);
          }}
        />,
        document.body,
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
function FxBody({ fx, L }) {
  const cur = fx?.currency ? CURRENCY_BY_CODE[fx.currency] : null;
  const isFromIls = fx?.direction === 'fromIls';
  const code = fx?.currency || '';
  return (
    <div className="fc-fx-converter">
      <div className="fc-fx-currency-row">
        <span className="fc-fx-flag">
          {cur
            ? <Flag country={cur.country} />
            : <span className="fc-fx-flag-empty">—</span>}
        </span>
        <div className="fc-field fc-field-grow">
          <label className="fc-field-label">מטבע</label>
          <select
            className="fc-input"
            value={fx?.currency || ''}
            onChange={(e) => L.setCurrency(e.target.value)}
          >
            <option value="">בחר מטבע...</option>
            {L.availableCurrencies.map((c) => (
              <option key={c.code} value={c.code}>{c.code} — {c.nameHe}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="fc-form-row">
        <div className="fc-field">
          <label className="fc-field-label">שנה</label>
          <select
            className="fc-input"
            value={fx?.year || ''}
            onChange={(e) => L.setYear(parseInt(e.target.value, 10))}
            disabled={!fx?.currency}
          >
            <option value="">--</option>
            {L.availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="fc-field">
          <label className="fc-field-label">חודש</label>
          <select
            className="fc-input"
            value={fx?.month || ''}
            onChange={(e) => L.setMonth(parseInt(e.target.value, 10))}
            disabled={!fx?.year}
          >
            <option value="">--</option>
            {L.availableMonths.map((m) => (
              <option key={m} value={m}>
                {String(m).padStart(2, '0')} — {MONTH_NAMES_HE[m - 1]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Direction toggle — labeled button (not icon). Display ONLY
          flips the button label; the rate readout below always shows
          the raw rate. */}
      <div className="fc-direction-toggle" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={!isFromIls}
          className={`fc-direction-tab ${!isFromIls ? 'is-active' : ''}`}
          onClick={() => isFromIls && L.toggleDirection()}
          disabled={!code}
        >
          {code ? `מ-${code} ל-₪` : 'מ-מטבע ל-₪'}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isFromIls}
          className={`fc-direction-tab ${isFromIls ? 'is-active' : ''}`}
          onClick={() => !isFromIls && L.toggleDirection()}
          disabled={!code}
        >
          {code ? `מ-₪ ל-${code}` : 'מ-₪ למטבע'}
        </button>
      </div>

      <div className="fc-rate-display">
        {L.currentRate != null
          ? <span className="fc-rate-value">{L.formattedDisplay}</span>
          : <span className="fc-rate-empty">בחר מטבע, שנה וחודש כדי לראות שער</span>}
      </div>
    </div>
  );
}
