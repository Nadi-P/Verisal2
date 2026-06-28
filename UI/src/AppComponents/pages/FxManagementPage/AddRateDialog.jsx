import React from 'react';
import {
  CURRENCIES, CURRENCY_BY_CODE, MONTH_NAMES_HE, matchesQuery,
} from './currencies.js';
import Flag from './Flag.jsx';
import { IconBack, IconSearch } from '../../components/icons.jsx';
// Ensures the dialog's styles (.fx-overlay, .fx-dialog, .fx-currency-*)
// are loaded even when the dialog is rendered from outside FxManagementPage.
import './FxManagementPage.css';

/**
 * Standalone Add-Rate dialog, extracted so the FieldConfigScreen FX
 * section can reuse it. Shape:
 *
 *   Currency (searchable select; optional pre-selection via `initialCurrency`)
 *   Year (text, 1900–2100)
 *   Month (select)
 *   Rate (decimal > 0)
 *
 * Props:
 *   initialCurrency    — string or null
 *   findRate           — (currency, year, month) → existing or null
 *   onClose            — dismiss
 *   onSave             — (payload) → caller persists; gets to fire confirm-overwrite
 */
export default function AddRateDialog({ initialCurrency, findRate, onClose, onSave }) {
  const currentYear = new Date().getFullYear();
  const [currency, setCurrency] = React.useState(initialCurrency || '');
  const [year, setYear]   = React.useState(String(currentYear));
  const [month, setMonth] = React.useState('');
  const [rate, setRate]   = React.useState('');

  const yearNum  = parseInt(year,  10);
  const monthNum = parseInt(month, 10);
  const rateNum  = parseFloat(rate);

  const yearValid  = Number.isFinite(yearNum)  && yearNum >= 1900 && yearNum <= 2100;
  const monthValid = Number.isFinite(monthNum) && monthNum >= 1 && monthNum <= 12;
  const rateValid  = Number.isFinite(rateNum)  && rateNum > 0;
  const allValid   = !!currency && yearValid && monthValid && rateValid;

  const existing = (currency && yearValid && monthValid)
    ? findRate(currency, yearNum, monthNum)
    : null;

  return (
    <div className="fx-overlay" onClick={onClose}>
      <div className="fx-dialog" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <header className="fx-dialog-header">
          <button
            type="button"
            className="fx-icon-btn"
            onClick={onClose}
            aria-label="סגור"
          ><IconBack size={16} /></button>
          <span className="fx-dialog-title">הוספת שער</span>
        </header>

        <div className="fx-dialog-body">
          <label className="fx-field">
            <span className="fx-field-label">מטבע</span>
            <CurrencySelect
              value={currency}
              onChange={setCurrency}
              currencies={CURRENCIES}
              placeholder="בחר מטבע..."
            />
          </label>
          <div className="fx-form-row">
            <label className="fx-field">
              <span className="fx-field-label">שנה</span>
              <input
                type="text" inputMode="numeric" dir="ltr"
                className={`fx-input ${year && !yearValid ? 'is-invalid' : ''}`}
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="2026"
              />
            </label>
            <label className="fx-field">
              <span className="fx-field-label">חודש</span>
              <select
                className={`fx-input ${month && !monthValid ? 'is-invalid' : ''}`}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                <option value="">--</option>
                {MONTH_NAMES_HE.map((name, i) => (
                  <option key={i + 1} value={i + 1}>
                    {String(i + 1).padStart(2, '0')} — {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="fx-field">
            <span className="fx-field-label">שער (1 מטבע = X ₪)</span>
            <input
              type="text" inputMode="decimal" dir="ltr"
              className={`fx-input ${rate && !rateValid ? 'is-invalid' : ''}`}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.00"
            />
          </label>

          <div className={`fx-existence-note ${existing ? 'is-warn' : ''}`}>
            {!currency || !yearValid || !monthValid
              ? 'הזן מטבע, שנה וחודש כדי לבדוק קיום.'
              : existing
                ? `קיים שער למטבע זה בתאריך זה (${existing.rate}). שמירה תדרוס.`
                : 'אין שער קיים לתאריך זה — שמירה תיצור שער חדש.'}
          </div>
        </div>

        <footer className="fx-dialog-actions">
          <button type="button" className="fx-btn fx-btn-ghost" onClick={onClose}>ביטול</button>
          <button
            type="button"
            className="fx-btn fx-btn-primary"
            disabled={!allValid}
            onClick={() => onSave({
              currency, year: yearNum, month: monthNum, rate: rateNum,
            })}
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
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false); setSearch('');
      }
    }
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
