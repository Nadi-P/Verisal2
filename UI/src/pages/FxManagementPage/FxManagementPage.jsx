import React from 'react';
import { useFxManagementPageLogic } from './FxManagementPage.logic.jsx';
import {
  CURRENCIES, CURRENCY_BY_CODE, MONTH_NAMES_HE,
  matchesQuery, formatRateDisplay,
} from './currencies.js';
import Flag from './Flag.jsx';
import AddRateDialog from './AddRateDialog.jsx';
import ApplianceDialog from './ApplianceDialog.jsx';
import FxAppliancesPanel from './FxAppliancesPanel.jsx';
import { IconPlus, IconSearch, IconDots, IconBack } from '../../components/icons.jsx';
import ConfirmDialog from '../../components/pivot/PivotSidePanel/ConfirmDialog/ConfirmDialog.jsx';
import './FxManagementPage.css';

/* =====================================================================
   FxManagementPage
   =====================================================================
   Top: search bar + global "הוסף שער" button.
   Body: grid of currency cards (filtered by search).
   Floats: AddRateDialog, RemoveRateDialog, ConfirmDialog, toast.
   ===================================================================== */
export default function FxManagementPage() {
  const L = useFxManagementPageLogic();
  // Appliance dialog state — null when closed; an object (or {}) when open.
  const [appliance, setAppliance] = React.useState(null);
  const openAddAppliance  = React.useCallback(() => setAppliance({}),       []);
  const openEditAppliance = React.useCallback((a) => setAppliance(a),       []);
  const closeAppliance    = React.useCallback(() => setAppliance(null),     []);

  if (L.loading) {
    return (
      <div className="fx-page">
        <div className="fx-loading">טוען שערי מט"ח...</div>
      </div>
    );
  }

  // Default view (no search): only currencies that have AT LEAST ONE rate.
  // With a search query: every currency that matches, regardless of whether
  // it has rates yet — so the user can add a rate to a fresh currency.
  const hasQuery = L.query.trim().length > 0;
  const filtered = CURRENCIES.filter((c) => {
    if (hasQuery) return matchesQuery(c, L.query);
    return !!L.ratesByCurrency[c.code]; // only currencies WITH any rate
  });

  return (
    <div className="fx-page">
      <header className="fx-header">
        <div className="fx-title-block">
          <h1 className="fx-title">ניהול שערי מט"ח</h1>
          <p className="fx-subtitle">
            צד שמאל — הצמדות פעילות לעמודות. צד ימין — הספרייה המלאה.
          </p>
        </div>

        <div className="fx-cards-toolbar">
            <div className="fx-search">
              <IconSearch size={16} />
              <input
                type="text"
                className="fx-search-input"
                placeholder="חיפוש מטבע..."
                value={L.query}
                onChange={(e) => L.setQuery(e.target.value)}
                dir="rtl"
              />
              {L.query && (
                <button
                  className="fx-search-clear"
                  type="button"
                  onClick={() => L.setQuery('')}
                  aria-label="נקה חיפוש"
                >×</button>
              )}
            </div>
            <button
              className="fx-btn fx-btn-primary"
              onClick={() => L.openAddDialog(null)}
            >
              <IconPlus size={16} /> הוסף שער
            </button>
          </div>
      </header>

      {/* 1:3 split — appliances panel on the start side, cards on the
          end side. The cards column owns its own search/add toolbar. */}
      <div className="fx-page-body">
        


        <div className="fx-card-grid">
            {filtered.length === 0 ? (
              <div className="fx-empty">לא נמצאו מטבעות התואמים את החיפוש</div>
            ) : (
              filtered.map((cur, idx) => (
                <CurrencyCard
                  key={cur.code}
                  index={idx}
                  currency={cur}
                  ratesByYear={L.ratesByCurrency[cur.code] || {}}
                  onAdd={()    => L.openAddDialog(cur.code)}
                  onRemove={() => L.openRemoveDialog(cur.code)}
                />
              ))
            )}
        </div>
        <FxAppliancesPanel
          ratesByCurrency={L.ratesByCurrency}
          onAddAppliance={openAddAppliance}
          onEdit={openEditAppliance}
        />
      </div>

      {appliance && (
        <ApplianceDialog
          editing={appliance && appliance.field ? appliance : null}
          ratesByCurrency={L.ratesByCurrency}
          onClose={closeAppliance}
          onSaved={() => { /* panel listens via event */ }}
        />
      )}

      {L.dialog && L.dialog.kind === 'add' && (
        <AddRateDialog
          initialCurrency={L.dialog.currency}
          findRate={L.findRate}
          onClose={L.closeDialog}
          onSave={async (payload) => {
            const existing = L.findRate(payload.currency, payload.year, payload.month);
            if (existing) {
              L.setConfirm({
                kind: 'overwrite',
                payload,
                message: `קיים כבר שער למטבע ${payload.currency} בתאריך ${String(payload.month).padStart(2,'0')}/${payload.year}. האם לדרוס אותו?`,
              });
              return;
            }
            const ok = await L.upsertRate(payload);
            if (ok) L.closeDialog();
          }}
        />
      )}

      {L.dialog && L.dialog.kind === 'remove' && (
        <RemoveRateDialog
          initialCurrency={L.dialog.currency}
          currenciesWithAnyRate={L.currenciesWithAnyRate}
          yearsWithRatesFor={L.yearsWithRatesFor}
          monthsWithRatesFor={L.monthsWithRatesFor}
          findRate={L.findRate}
          onClose={L.closeDialog}
          onRemove={(payload) => {
            L.setConfirm({
              kind: 'remove',
              payload,
              message: `האם להסיר את השער של ${payload.currency} בתאריך ${String(payload.month).padStart(2,'0')}/${payload.year}?`,
            });
          }}
        />
      )}

      {L.confirm && (
        <ConfirmDialog
          title={L.confirm.kind === 'remove' ? 'אישור הסרת שער' : 'אישור דריסה'}
          message={L.confirm.message}
          confirmLabel={L.confirm.kind === 'remove' ? 'הסר' : 'אשר ודרוס'}
          variant="danger"
          onCancel={L.closeConfirm}
          onConfirm={async () => {
            if (L.confirm.kind === 'overwrite') {
              const ok = await L.upsertRate(L.confirm.payload);
              L.closeConfirm();
              if (ok) L.closeDialog();
            } else if (L.confirm.kind === 'remove') {
              const ok = await L.removeRate(L.confirm.payload);
              L.closeConfirm();
              if (ok) L.closeDialog();
            }
          }}
        />
      )}

      {L.toast && (
        <div className={`report-page-toast report-page-toast-${L.toast.type}`}>
          {L.toast.message}
        </div>
      )}
    </div>
  );
}

/* =====================================================================
   CurrencyCard
   ===================================================================== */
function CurrencyCard({ currency, ratesByYear, onAdd, onRemove, index }) {
  const yearsWithRates = React.useMemo(
    () => Object.keys(ratesByYear || {}).map(Number).sort((a, b) => a - b),
    [ratesByYear],
  );
  // Default view = LATEST year with a rate; falls back to current year
  // when this currency has no rates yet.
  const latestYear = yearsWithRates.length > 0
    ? yearsWithRates[yearsWithRates.length - 1]
    : new Date().getFullYear();
  const [year, setYear] = React.useState(latestYear);
  // Direction of the LAST switch — drives the slide animation. -1 = went
  // backward (older year), +1 = went forward (newer year).
  const [direction, setDirection] = React.useState(0);
  const [menuOpen, setMenuOpen] = React.useState(false);
  const menuRef = React.useRef(null);

  // If the data updates such that the card's currency just gained its
  // first rate, snap to that year.
  React.useEffect(() => {
    if (yearsWithRates.length > 0 && !yearsWithRates.includes(year)) {
      setYear(yearsWithRates[yearsWithRates.length - 1]);
      setDirection(0);
    }
  }, [yearsWithRates, year]);

  React.useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen]);

  // Months that ACTUALLY have a rate for the displayed year. Empty
  // months are not rendered. Year/month keys come off the JSON as
  // strings — read them that way and let the consumer pull the rate
  // directly (the nested map stores rate as a bare number).
  const monthsMap = ratesByYear[String(year)] || {};
  const monthsWithRates = Object.keys(monthsMap).map(Number).sort((a, b) => a - b);

  // Disable an arrow when no rate exists in that direction. Forward = a
  // year with rates greater than the current one; backward = a year with
  // rates smaller than the current one.
  const hasNewer = yearsWithRates.some((y) => y > year);
  const hasOlder = yearsWithRates.some((y) => y < year);
  const goBack    = () => { if (hasOlder) { setDirection(-1); setYear((y) => y - 1); } };
  const goForward = () => { if (hasNewer) { setDirection( 1); setYear((y) => y + 1); } };

  return (
    <article className="fx-card" style={{ '--i': index }}>
      <header className="fx-card-header">
        <Flag country={currency.country} />
        <div className="fx-card-title">
          <span className="fx-card-code">{currency.code}</span>
          <span className="fx-card-name">{currency.nameHe}</span>
        </div>

        <div className="fx-card-menu-anchor" ref={menuRef}>
          <button
            type="button"
            className="fx-icon-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="אפשרויות"
          >
            <IconDots size={16} />
          </button>
          {menuOpen && (
            <div className="fx-card-menu" role="menu">
              <button
                type="button"
                className="fx-card-menu-item"
                onClick={() => { setMenuOpen(false); onAdd(); }}
              >הוסף שער</button>
              <button
                type="button"
                className="fx-card-menu-item fx-card-menu-item-danger"
                onClick={() => { setMenuOpen(false); onRemove(); }}
              >הסר שער</button>
            </div>
          )}
        </div>
      </header>

      <div className="fx-card-year-nav">
        {/* In RTL the visual right arrow goes back, the visual left goes
            forward — DOM order doesn't matter, we control which button
            holds which handler so the labels match user expectation. */}
        <button
          type="button"
          className="fx-icon-btn fx-year-arrow"
          onClick={goForward}
          disabled={!hasNewer}
          aria-label="שנה הבאה"
        >‹</button>
        <span
          key={year}
          className={`fx-card-year ${direction > 0 ? 'is-forward' : direction < 0 ? 'is-backward' : ''}`}
        >{year}</span>
        <button
          type="button"
          className="fx-icon-btn fx-year-arrow"
          onClick={goBack}
          disabled={!hasOlder}
          aria-label="שנה קודמת"
        >›</button>
      </div>

      <ul
        key={year}
        className={`fx-month-list ${direction > 0 ? 'is-forward' : direction < 0 ? 'is-backward' : ''}`}
      >
        {monthsWithRates.length === 0 ? (
          <li className="fx-month-empty">אין שערים לשנה זו</li>
        ) : (
          monthsWithRates.map((m) => {
            const rate = monthsMap[String(m)];
            const display = formatRateDisplay(rate, currency);
            return (
              <li key={m} className="fx-month-row has-rate">
                <span className="fx-month-name">{MONTH_NAMES_HE[m - 1]}</span>
                <span className="fx-month-rate" dir="ltr">{display || ''}</span>
              </li>
            );
          })
        )}
      </ul>
    </article>
  );
}


/* =====================================================================
   RemoveRateDialog
   ===================================================================== */
function RemoveRateDialog({
  initialCurrency,
  currenciesWithAnyRate,
  yearsWithRatesFor,
  monthsWithRatesFor,
  findRate,
  onClose,
  onRemove,
}) {
  const [currency, setCurrency] = React.useState(initialCurrency || '');
  const [year, setYear]   = React.useState('');
  const [month, setMonth] = React.useState('');

  // Reset year+month whenever currency changes.
  React.useEffect(() => { setYear(''); setMonth(''); }, [currency]);
  // Reset month whenever year changes.
  React.useEffect(() => { setMonth(''); }, [year]);

  const currencyOptions = currenciesWithAnyRate
    .map((code) => CURRENCY_BY_CODE[code])
    .filter(Boolean);
  const years  = currency ? yearsWithRatesFor(currency) : [];
  const months = (currency && year) ? monthsWithRatesFor(currency, Number(year)) : [];

  const allValid = !!currency && !!year && !!month;
  const existing = allValid ? findRate(currency, Number(year), Number(month)) : null;

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
          <span className="fx-dialog-title">הסרת שער</span>
        </header>

        <div className="fx-dialog-body">
          <FormField label="מטבע">
            <CurrencySelect
              value={currency}
              onChange={setCurrency}
              currencies={currencyOptions}
              placeholder={currencyOptions.length === 0 ? 'אין שערים שמורים' : 'בחר מטבע...'}
              disabled={currencyOptions.length === 0}
            />
          </FormField>
          <div className="fx-form-row">
            <FormField label="שנה">
              <select
                className="fx-input"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                disabled={!currency}
              >
                <option value="">--</option>
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </FormField>
            <FormField label="חודש">
              <select
                className="fx-input"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                disabled={!year}
              >
                <option value="">--</option>
                {months.map((m) => (
                  <option key={m} value={m}>
                    {String(m).padStart(2, '0')} — {MONTH_NAMES_HE[m - 1]}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          {allValid && existing && (
            <div className="fx-existence-note">
              השער הקיים: {existing.rate}
            </div>
          )}
        </div>

        <footer className="fx-dialog-actions">
          <button
            type="button"
            className="fx-btn fx-btn-ghost"
            onClick={onClose}
          >ביטול</button>
          <button
            type="button"
            className="fx-btn fx-btn-danger"
            disabled={!allValid}
            onClick={() => onRemove({ currency, year: Number(year), month: Number(month) })}
          >הסר</button>
        </footer>
      </div>
    </div>
  );
}

/* =====================================================================
   Small reusable bits
   ===================================================================== */
function FormField({ label, children }) {
  return (
    <label className="fx-field">
      <span className="fx-field-label">{label}</span>
      {children}
    </label>
  );
}

function CurrencySelect({ value, onChange, currencies, placeholder, disabled }) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const wrapRef = React.useRef(null);

  React.useEffect(() => {
    if (!open) return;
    function onDoc(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
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
                onClick={() => {
                  onChange(c.code);
                  setOpen(false);
                  setSearch('');
                }}
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
