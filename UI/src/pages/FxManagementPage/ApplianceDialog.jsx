import React from 'react';
import { useUploadManager } from '../../contexts/UploadManagerContext.jsx';
import {
  CURRENCIES, CURRENCY_BY_CODE, MONTH_NAMES_HE, matchesQuery,
} from './currencies.js';
import Flag from './Flag.jsx';
import { IconBack, IconSearch } from '../../components/icons.jsx';
import './FxManagementPage.css';

const API_BASE = '';
const REPORT_LABELS = {
  center: 'מרכז שכר', costing: 'תמחיר', income: 'הכנסות זקופות',
  absences: 'היעדרויות', deductions: 'ניכויי רשות', providents: 'קופות גמל',
  components: 'רכיבי שכר', social_analysis: 'אנליזה סוציאלית',
  months_comparison: 'השוואת חודשים', reports_against_center: 'דוחות מול מרכז',
};

/**
 * Used both to ADD a new appliance and EDIT an existing one. In edit
 * mode the report+column selects are locked to the existing target;
 * only currency/year/month are mutable. Save is disabled until every
 * input is valid.
 *
 * Props:
 *   editing         — { reportId, field, fxConfig } | null
 *   ratesByCurrency — full nested rate map (restricts year/month options)
 *   onClose
 *   onSaved         — invoked after a successful POST
 */
export default function ApplianceDialog({ editing, ratesByCurrency, onClose, onSaved }) {
  const { payload } = useUploadManager();
  const isEdit = !!editing;

  const [reportId, setReportId] = React.useState(editing?.reportId || '');
  const [field, setField]       = React.useState(editing?.field || '');
  const [currency, setCurrency] = React.useState(editing?.fxConfig?.currency || '');
  const [year, setYear]         = React.useState(editing?.fxConfig?.year ? String(editing.fxConfig.year) : '');
  const [month, setMonth]       = React.useState(editing?.fxConfig?.month ? String(editing.fxConfig.month) : '');

  const reportOptions = React.useMemo(() => {
    if (!payload?.reports) return [];
    return Object.values(payload.reports)
      .filter((r) => r.status === 'loaded')
      .map((r) => ({
        id: r.id,
        label: r.display_label || REPORT_LABELS[r.id] || r.id,
      }));
  }, [payload]);

  // Numeric-only column candidates for the chosen report.
  const fieldOptions = React.useMemo(() => {
    const cols = payload?.reports?.[reportId]?.lineageFrame?.columns;
    if (!Array.isArray(cols)) return [];
    return cols.filter((col) => {
      const cells = col.cells || [];
      if (cells.length === 0) return false;
      return cells.every((c) => {
        const v = c.value;
        if (v === null || v === undefined || v === '') return true;
        if (typeof v === 'number') return !Number.isNaN(v);
        const n = parseFloat(String(v).replace(/,/g, ''));
        return !Number.isNaN(n);
      });
    }).map((col) => col.name);
  }, [payload, reportId]);

  React.useEffect(() => { if (!isEdit) setField(''); }, [reportId, isEdit]);
  React.useEffect(() => { setYear(''); setMonth(''); }, [currency]);
  React.useEffect(() => { setMonth(''); }, [year]);

  const availableCurrencies = React.useMemo(() => Object.keys(ratesByCurrency || {})
    .map((code) => CURRENCY_BY_CODE[code])
    .filter(Boolean), [ratesByCurrency]);
  const availableYears = React.useMemo(() => {
    if (!currency) return [];
    const yMap = ratesByCurrency?.[currency];
    return yMap ? Object.keys(yMap).map(Number).sort((a, b) => a - b) : [];
  }, [ratesByCurrency, currency]);
  const availableMonths = React.useMemo(() => {
    if (!currency || !year) return [];
    const mMap = ratesByCurrency?.[currency]?.[String(year)];
    return mMap ? Object.keys(mMap).map(Number).sort((a, b) => a - b) : [];
  }, [ratesByCurrency, currency, year]);

  const allValid = !!reportId && !!field && !!currency && !!year && !!month;

  const save = async () => {
    const fxConfig = {
      currency,
      direction: editing?.fxConfig?.direction || 'toIls',
      year:  Number(year),
      month: Number(month),
    };
    try {
      const res = await fetch(`${API_BASE}/api/fx-appliances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportId, field, fxConfig }),
      });
      if (!res.ok) return;
      window.dispatchEvent(new CustomEvent('fx-appliances-updated'));
      onSaved?.();
      onClose?.();
    } catch { /* non-fatal */ }
  };

  return (
    <div className="fx-overlay" onClick={onClose}>
      <div className="fx-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="fx-dialog-header">
          <button type="button" className="fx-icon-btn" onClick={onClose} aria-label="סגור">
            <IconBack size={16} />
          </button>
          <span className="fx-dialog-title">{isEdit ? 'עריכת הצמדה' : 'הצמדת מטבע לעמודה'}</span>
        </header>

        <div className="fx-dialog-body">
          <label className="fx-field">
            <span className="fx-field-label">דוח</span>
            <select
              className="fx-input"
              value={reportId}
              onChange={(e) => setReportId(e.target.value)}
              disabled={isEdit}
            >
              <option value="">בחר דוח...</option>
              {reportOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </label>

          <label className="fx-field">
            <span className="fx-field-label">עמודה</span>
            <select
              className="fx-input"
              value={field}
              onChange={(e) => setField(e.target.value)}
              disabled={isEdit || !reportId}
            >
              <option value="">בחר עמודה...</option>
              {fieldOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="fx-field">
            <span className="fx-field-label">מטבע</span>
            <CurrencySelect
              value={currency}
              onChange={setCurrency}
              currencies={availableCurrencies}
              placeholder="בחר מטבע..."
            />
          </label>

          <div className="fx-form-row">
            <label className="fx-field">
              <span className="fx-field-label">שנה</span>
              <select
                className="fx-input"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={!currency}
              >
                <option value="">--</option>
                {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </label>
            <label className="fx-field">
              <span className="fx-field-label">חודש</span>
              <select
                className="fx-input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={!year}
              >
                <option value="">--</option>
                {availableMonths.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')} — {MONTH_NAMES_HE[m - 1]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <footer className="fx-dialog-actions">
          <button type="button" className="fx-btn fx-btn-ghost" onClick={onClose}>ביטול</button>
          <button
            type="button"
            className="fx-btn fx-btn-primary"
            disabled={!allValid}
            onClick={save}
          >שמור</button>
        </footer>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
function CurrencySelect({ value, onChange, currencies, placeholder, disabled }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) { setOpen(false); setSearch(''); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = value ? CURRENCY_BY_CODE[value] : null;
  const filtered = currencies.filter((c) => matchesQuery(c, search));

  return (
    <div className={`fx-currency-select ${disabled ? 'is-disabled' : ''}`} ref={wrapRef}>
      <button
        type="button"
        className="fx-currency-trigger"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {selected ? (
          <>
            <Flag country={selected.country} className="fx-flag-sm" />
            <span className="fx-currency-trigger-code">{selected.code}</span>
            <span className="fx-currency-trigger-name">{selected.nameHe}</span>
          </>
        ) : (
          <span className="fx-currency-trigger-placeholder">{placeholder || 'בחר...'}</span>
        )}
        <span className="fx-currency-trigger-caret">▾</span>
      </button>

      {open && (
        <div className="fx-currency-dropdown" role="listbox">
          <div className="fx-currency-search">
            <IconSearch size={14} />
            <input
              autoFocus
              type="text"
              className="fx-currency-search-input"
              placeholder="חיפוש..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              dir="rtl"
            />
          </div>
          <div className="fx-currency-options">
            {filtered.length === 0 ? (
              <div className="fx-currency-empty">אין תוצאות</div>
            ) : filtered.map((c) => (
              <button
                type="button"
                key={c.code}
                className={`fx-currency-option ${c.code === value ? 'is-selected' : ''}`}
                onClick={() => { onChange(c.code); setOpen(false); setSearch(''); }}
              >
                <Flag country={c.country} className="fx-flag-sm" />
                <span className="fx-currency-option-code">{c.code}</span>
                <span className="fx-currency-option-name">{c.nameHe}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
