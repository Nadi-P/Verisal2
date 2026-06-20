import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const API_BASE = '';

/**
 * Hook owning every piece of state the Axiology page needs:
 *   - the persisted catalog ({ recordTypes, codes })
 *   - the active category filter (string recordType, or null for "all")
 *   - the search query (matches code OR name)
 *   - which dialog (add / edit) is open and which row it targets
 *   - the toast queue (single message, auto-dismiss)
 */
export function useAxiologyLogic() {
  const [data, setData]       = useState({ recordTypes: {}, codes: {} });
  const [loading, setLoading] = useState(true);

  const [activeCategory, setActiveCategory] = useState(null);   // null = "all"
  const [query, setQuery]   = useState('');
  const [dialog, setDialog] = useState(null);   // { mode:'add'|'edit', recordType?, code?, name? }
  const [confirm, setConfirm] = useState(null); // { recordType, code, name } | null

  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);
  const showToast = useCallback((message, type = 'success') => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  /* ---- Load on mount ---- */
  const reload = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/axiology`);
      if (!res.ok) throw new Error('http');
      const body = await res.json();
      setData({
        recordTypes: body.recordTypes || {},
        codes:       body.codes       || {},
      });
    } catch {
      showToast('שגיאה בטעינת הקטלוג', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { reload(); }, [reload]);

  /* ---- Derived: counts + flattened list + filtered view ---- */
  const totalCount = useMemo(() =>
    Object.values(data.codes).reduce((sum, arr) => sum + arr.length, 0),
  [data.codes]);

  const countsByRecordType = useMemo(() => {
    const out = {};
    for (const rt of Object.keys(data.recordTypes)) {
      out[rt] = (data.codes[rt] || []).length;
    }
    return out;
  }, [data]);

  const flatEntries = useMemo(() => {
    const out = [];
    const rts = activeCategory ? [activeCategory] : Object.keys(data.recordTypes);
    for (const rt of rts) {
      for (const e of data.codes[rt] || []) {
        out.push({
          recordType:      rt,
          recordTypeLabel: data.recordTypes[rt] || rt,
          code:            e.code,
          name:            e.name,
        });
      }
    }
    return out;
  }, [data, activeCategory]);

  const filteredEntries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return flatEntries;
    return flatEntries.filter((e) =>
      String(e.code).includes(q)
      || (e.name || '').toLowerCase().includes(q)
    );
  }, [flatEntries, query]);

  /* ---- Validation helpers used by the dialog ---- */
  const isCodeAvailable = useCallback((recordType, code, ignoringOldCode = null) => {
    const list = data.codes[recordType] || [];
    return !list.some((e) => Number(e.code) === Number(code) && Number(e.code) !== Number(ignoringOldCode));
  }, [data.codes]);

  /* ---- Mutations ---- */
  const upsertEntry = useCallback(async ({ recordType, oldCode, code, name }) => {
    try {
      const res = await fetch(`${API_BASE}/api/axiology`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordType, oldCode, code, name }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.detail || 'שגיאה בשמירת הקוד', 'error');
        return false;
      }
      await reload();
      showToast(oldCode == null ? 'קוד נוסף בהצלחה' : 'הקוד עודכן בהצלחה');
      return true;
    } catch {
      showToast('שגיאה בשמירת הקוד', 'error');
      return false;
    }
  }, [reload, showToast]);

  const removeEntry = useCallback(async ({ recordType, code }) => {
    try {
      const res = await fetch(`${API_BASE}/api/axiology/${encodeURIComponent(recordType)}/${encodeURIComponent(code)}`, { method: 'DELETE' });
      if (!res.ok) {
        showToast('שגיאה בהסרת הקוד', 'error');
        return false;
      }
      await reload();
      showToast('הקוד הוסר בהצלחה');
      return true;
    } catch {
      showToast('שגיאה בהסרת הקוד', 'error');
      return false;
    }
  }, [reload, showToast]);

  /* ---- Dialog control ---- */
  const openAdd  = useCallback((recordType = null) =>
    setDialog({ mode: 'add', recordType: recordType || '' , code: '', name: '' }), []);
  const openEdit = useCallback((entry) =>
    setDialog({ mode: 'edit', recordType: entry.recordType, oldCode: entry.code, code: entry.code, name: entry.name }), []);
  const closeDialog  = useCallback(() => setDialog(null),  []);
  const closeConfirm = useCallback(() => setConfirm(null), []);

  return {
    loading, data,
    activeCategory, setActiveCategory,
    query, setQuery,
    totalCount, countsByRecordType,
    filteredEntries,
    isCodeAvailable,

    dialog, openAdd, openEdit, closeDialog,
    confirm, setConfirm, closeConfirm,

    upsertEntry, removeEntry,

    toast, showToast,
  };
}
