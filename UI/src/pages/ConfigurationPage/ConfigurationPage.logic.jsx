import { useState, useEffect, useCallback, useRef } from 'react';

// Empty base = relative URLs → Vite dev server proxies /api/* to uvicorn.
const API_BASE = '';

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function useConfigurationPageLogic() {
  // ---- FX state ----
  const [savedFx, setSavedFx] = useState({});
  const [draftFx, setDraftFx] = useState({});

  const [loading, setLoading] = useState(true);
  const [savingFx, setSavingFx] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  // ---- Load on mount ----
  useEffect(() => {
    async function load() {
      try {
        const fxRes = await fetch(`${API_BASE}/api/config/fx`);
        const fxData = await fxRes.json();
        setSavedFx(fxData);
        setDraftFx(deepClone(fxData));
      } catch {
        showToast('שגיאה בטעינת הגדרות', 'error');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showToast]);

  const fxDirty = JSON.stringify(draftFx) !== JSON.stringify(savedFx);

  // ---- FX CRUD ----
  const addFxRate = useCallback(() => {
    const id = `fx_${Date.now()}`;
    setDraftFx(prev => ({
      ...prev,
      [id]: { currency: '', month: 1, year: 2026, rate: 0 },
    }));
  }, []);

  const removeFxRate = useCallback((id) => {
    setDraftFx(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }, []);

  const updateFxRate = useCallback((id, field, value) => {
    setDraftFx(prev => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: (field === 'month' || field === 'year')
          ? parseInt(value) || 0
          : field === 'rate'
            ? parseFloat(value) || 0
            : value,
      },
    }));
  }, []);

  const saveFx = useCallback(async () => {
    setSavingFx(true);
    try {
      const res = await fetch(`${API_BASE}/api/config/fx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftFx),
      });
      if (res.ok) {
        setSavedFx(deepClone(draftFx));
        showToast('שערי המט״ח נשמרו בהצלחה');
      } else {
        showToast('שגיאה בשמירת שערי מט״ח', 'error');
      }
    } catch {
      showToast('שגיאה בשמירת שערי מט״ח', 'error');
    } finally {
      setSavingFx(false);
    }
  }, [draftFx, showToast]);

  const discardFx = useCallback(() => {
    setDraftFx(deepClone(savedFx));
    showToast('השינויים בוטלו');
  }, [savedFx, showToast]);

  const savedFxCount = Object.keys(savedFx).length;

  return {
    loading,
    toast,
    savedFxCount,

    draftFx,
    fxDirty,
    savingFx,
    addFxRate,
    removeFxRate,
    updateFxRate,
    saveFx,
    discardFx,
  };
}
