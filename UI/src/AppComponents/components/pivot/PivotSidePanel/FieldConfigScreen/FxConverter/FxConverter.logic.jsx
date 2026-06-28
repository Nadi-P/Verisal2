import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  CURRENCIES, CURRENCY_BY_CODE, formatRateDisplay,
} from '../../../../../pages/FxManagementPage/currencies.js';

import { API_BASE } from '../../../../../../lib/apiBase.js';

/**
 * FX-converter hook for ONE field.
 *
 * Fetches the persisted FX map once and keeps a local copy so:
 *   - the currency / year / month selects can be restricted to existing data
 *   - the "current rate" readout can compute its display string
 *   - the Add-Rate dialog can persist a new rate and have the converter
 *     instantly see it
 *
 * fx shape (config slot):
 *   { currency: 'USD', direction: 'toIls' | 'fromIls', month: 1..12, year: 2026 }
 */
export function useFxConverterLogic({ fx, onChange }) {
  const [rates, setRates] = useState({});

  // Initial load + on Add-Rate persist we re-set.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/config/fx`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setRates(data || {});
      } catch { /* non-fatal */ }
    })();
    return () => { cancelled = true; };
  }, []);

  /* ---- Available selection options (restricted to existing rates) ---- */
  const availableCurrencies = useMemo(
    () => Object.keys(rates)
      .map((code) => CURRENCY_BY_CODE[code])
      .filter(Boolean),
    [rates],
  );

  const availableYears = useMemo(() => {
    const yMap = fx?.currency ? rates[fx.currency] : null;
    if (!yMap) return [];
    return Object.keys(yMap).map(Number).sort((a, b) => a - b);
  }, [rates, fx?.currency]);

  const availableMonths = useMemo(() => {
    const yMap = fx?.currency ? rates[fx.currency] : null;
    const mMap = yMap && fx?.year ? yMap[String(fx.year)] : null;
    if (!mMap) return [];
    return Object.keys(mMap).map(Number).sort((a, b) => a - b);
  }, [rates, fx?.currency, fx?.year]);

  /* ---- Lookups ---- */
  const findRate = useCallback((code, year, month) => {
    const v = rates?.[code]?.[String(year)]?.[String(month)];
    return (typeof v === 'number' && isFinite(v)) ? { rate: v } : null;
  }, [rates]);

  const currentRate = useMemo(() => {
    if (!fx?.currency || !fx?.year || !fx?.month) return null;
    const found = findRate(fx.currency, fx.year, fx.month);
    return found ? found.rate : null;
  }, [findRate, fx?.currency, fx?.year, fx?.month]);

  // Display the rate ALWAYS in its natural form (`1 [FX] = rate ₪` when
  // the foreign currency is stronger, else `1 ₪ = (1/rate) [FX]`).
  // Direction (toIls/fromIls) only governs how the value gets APPLIED to
  // cells — not how the rate is shown.
  const formattedDisplay = useMemo(() => {
    if (currentRate == null) return '';
    const cur = CURRENCY_BY_CODE[fx.currency];
    if (!cur) return String(currentRate);
    return formatRateDisplay(currentRate, cur);
  }, [currentRate, fx?.currency]);

  /* ---- Setters that funnel through `onChange` ---- */
  const merge = useCallback((patch) => {
    onChange({ ...(fx || {}), ...patch });
  }, [fx, onChange]);

  const setCurrency = useCallback((code) => {
    // When the currency changes, year/month from the previous one are
    // probably invalid → clear them.
    onChange({
      currency:  code,
      direction: fx?.direction || 'toIls',
      year:      undefined,
      month:     undefined,
    });
  }, [fx?.direction, onChange]);

  const setYear  = useCallback((year)  => merge({ year, month: undefined }), [merge]);
  const setMonth = useCallback((month) => merge({ month }),                  [merge]);

  const toggleDirection = useCallback(() => {
    merge({ direction: fx?.direction === 'fromIls' ? 'toIls' : 'fromIls' });
  }, [fx?.direction, merge]);

  /* ---- Persist via the FX backend, then update local cache ----
     Broadcasts a `fx-rates-updated` event so other consumers (the
     report page's `fxRates` cache, the FX management page, etc.) can
     refresh and pick up the new rate without a full page reload —
     so a newly-added rate cascades into the columns that depend on
     it immediately. */
  const persistRate = useCallback(async ({ currency, year, month, rate }) => {
    const code = String(currency).toUpperCase().trim();
    const yr   = String(Number(year));
    const mo   = String(Number(month));
    const next = { ...rates };
    next[code] = { ...(next[code] || {}) };
    next[code][yr] = { ...(next[code][yr] || {}), [mo]: Number(rate) };
    try {
      const res = await fetch(`${API_BASE}/api/config/fx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) return false;
      setRates(next);
      window.dispatchEvent(new CustomEvent('fx-rates-updated', { detail: next }));
      return true;
    } catch {
      return false;
    }
  }, [rates]);

  // Listen for external updates (from the FX management page, etc.)
  // so the local cache stays in sync.
  useEffect(() => {
    const onUpdate = (e) => {
      if (e.detail && typeof e.detail === 'object') setRates(e.detail);
    };
    window.addEventListener('fx-rates-updated', onUpdate);
    return () => window.removeEventListener('fx-rates-updated', onUpdate);
  }, []);

  return {
    availableCurrencies, availableYears, availableMonths,
    findRate, currentRate, formattedDisplay,
    setCurrency, setYear, setMonth, toggleDirection,
    persistRate,
  };
}
