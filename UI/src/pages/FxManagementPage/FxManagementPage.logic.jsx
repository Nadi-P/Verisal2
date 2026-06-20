import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = '';

/**
 * FX state. Persisted shape is the same nested map the UI thinks in:
 *
 *     { "<CODE>": { "<year>": { "<month>": <rate> } } }
 *
 * Everything else (search, dialogs, confirms, toast) lives here too.
 */
export function useFxManagementPageLogic() {
  const [ratesByCurrency, setRates] = useState({});   // ← persisted shape, used directly
  const [loading, setLoading]       = useState(true);
  const [saving,  setSaving]        = useState(false);

  const [query, setQuery]   = useState('');
  const [dialog, setDialog] = useState(null);  // { kind: 'add' | 'remove', currency? }
  const [confirm, setConfirm] = useState(null);

  const [toast, setToast]   = useState(null);
  const toastTimer          = useRef(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ---- Load on mount ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/config/fx`);
        if (!res.ok) throw new Error('http');
        const data = await res.json();
        if (!cancelled) setRates(data || {});
      } catch {
        if (!cancelled) showToast('שגיאה בטעינת שערי המט"ח', 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [showToast]);

  // ---- Lookups (zero indirection — nested map IS the index) ---------
  const findRate = useCallback((code, year, month) => {
    const v = ratesByCurrency?.[code]?.[String(year)]?.[String(month)];
    return (typeof v === 'number' && isFinite(v))
      ? { rate: v }
      : null;
  }, [ratesByCurrency]);

  const yearsWithRatesFor = useCallback((code) => {
    const yMap = ratesByCurrency[code];
    if (!yMap) return [];
    return Object.keys(yMap).map(Number).sort((a, b) => a - b);
  }, [ratesByCurrency]);

  const monthsWithRatesFor = useCallback((code, year) => {
    const yMap = ratesByCurrency[code];
    if (!yMap || !yMap[String(year)]) return [];
    return Object.keys(yMap[String(year)]).map(Number).sort((a, b) => a - b);
  }, [ratesByCurrency]);

  const currenciesWithAnyRate = useMemo(
    () => Object.keys(ratesByCurrency),
    [ratesByCurrency],
  );

  // ---- Persistence: write the whole nested map back to the backend --
  const persist = useCallback(async (nextRates) => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/config/fx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextRates),
      });
      if (!res.ok) throw new Error('http');
      setRates(nextRates);
      // Notify every other consumer (open report pages, FxConverter
      // dialogs, etc.) so they refresh their local rate caches
      // immediately — the change cascades without a reload.
      window.dispatchEvent(new CustomEvent('fx-rates-updated', { detail: nextRates }));
      return true;
    } catch {
      return false;
    } finally {
      setSaving(false);
    }
  }, []);

  // Pick up external updates (e.g. from the side-panel FX converter)
  // so this page reflects fresh rates as soon as they're saved.
  useEffect(() => {
    const onUpdate = (e) => {
      if (e.detail && typeof e.detail === 'object') setRates(e.detail);
    };
    window.addEventListener('fx-rates-updated', onUpdate);
    return () => window.removeEventListener('fx-rates-updated', onUpdate);
  }, []);

  // ---- Mutations ----------------------------------------------------
  const upsertRate = useCallback(async ({ currency, year, month, rate }) => {
    const code = String(currency).toUpperCase().trim();
    const yr   = String(Number(year));
    const mo   = String(Number(month));
    const rt   = Number(rate);
    const existing = findRate(code, yr, mo);

    // Immutable deep update of the three involved levels.
    const next = { ...ratesByCurrency };
    next[code] = { ...(next[code] || {}) };
    next[code][yr] = { ...(next[code][yr] || {}), [mo]: rt };

    const ok = await persist(next);
    if (ok) {
      showToast(existing
        ? `שער ${code} ${String(month).padStart(2,'0')}/${year} עודכן`
        : `שער ${code} ${String(month).padStart(2,'0')}/${year} נשמר`);
    } else {
      showToast('שגיאה בשמירת השער', 'error');
    }
    return ok;
  }, [ratesByCurrency, findRate, persist, showToast]);

  const removeRate = useCallback(async ({ currency, year, month }) => {
    const code = String(currency).toUpperCase().trim();
    const yr   = String(Number(year));
    const mo   = String(Number(month));
    if (!findRate(code, yr, mo)) {
      showToast('השער שביקשת להסיר לא נמצא', 'error');
      return false;
    }

    // Immutable deep update + prune empty branches so the file stays tidy.
    const next = { ...ratesByCurrency };
    const yearMap = { ...(next[code] || {}) };
    const monthMap = { ...(yearMap[yr] || {}) };
    delete monthMap[mo];
    if (Object.keys(monthMap).length === 0) {
      delete yearMap[yr];
    } else {
      yearMap[yr] = monthMap;
    }
    if (Object.keys(yearMap).length === 0) {
      delete next[code];
    } else {
      next[code] = yearMap;
    }

    const ok = await persist(next);
    if (ok) showToast(`שער ${code} ${String(month).padStart(2,'0')}/${year} הוסר`);
    else    showToast('שגיאה בהסרת השער', 'error');
    return ok;
  }, [ratesByCurrency, findRate, persist, showToast]);

  // ---- Dialog control -----------------------------------------------
  const openAddDialog    = useCallback((currency) => setDialog({ kind: 'add',    currency: currency || null }), []);
  const openRemoveDialog = useCallback((currency) => setDialog({ kind: 'remove', currency: currency || null }), []);
  const closeDialog      = useCallback(() => setDialog(null), []);
  const closeConfirm     = useCallback(() => setConfirm(null), []);

  return {
    loading, saving,
    ratesByCurrency,
    findRate, yearsWithRatesFor, monthsWithRatesFor, currenciesWithAnyRate,

    query, setQuery,

    dialog, openAddDialog, openRemoveDialog, closeDialog,
    confirm, setConfirm, closeConfirm,

    upsertRate, removeRate,

    toast, showToast,
  };
}
